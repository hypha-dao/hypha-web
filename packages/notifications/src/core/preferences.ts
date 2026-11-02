import { sdkClient } from '../sdk/client';
import {
  isTagDisabled,
  SUBSCRIPTION_TAGS,
  SubscriptionTag,
  TAG_EMAIL,
  TAG_PUSH,
  TAG_SUB_OWN_ACTIONS,
  TAG_SUBSCRIBED,
  TAG_VALUE_DISABLED,
} from '../constants';

/**
 * Server-side read/write of a person's notification settings on their OneSignal user, so the
 * Notification Centre works without the browser SDK (#2611). The OneSignal user is addressed by
 * `external_id` = the person's slug, which the caller resolves from the verified auth token -
 * never from client input. Tags stay the single source of truth (same data `consent-gate.ts` reads).
 */

export interface NotificationPreferences {
  /** Account-level enrolment: the `subscribed` tag is `'true'` (#2549 D6). */
  subscribed: boolean;
  /** The user-level `push` tag allows push (per-device state stays in the browser SDK). */
  pushTagEnabled: boolean;
  /** The user-level `email` tag allows email. */
  emailEnabled: boolean;
  subscriptions: { name: SubscriptionTag; value: boolean }[];
}

export interface NotificationPreferencesUpdate {
  /** Omit to leave the user-level push tag alone (push is per device, #2549 D25). */
  pushTagEnabled?: boolean;
  emailEnabled: boolean;
  subscriptions: { name: SubscriptionTag; value: boolean }[];
}

const SUBSCRIPTION_TAG_NAMES: readonly string[] = SUBSCRIPTION_TAGS;

function getAppId(): string {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  if (!appId) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }
  return appId;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 404
  );
}

type OneSignalUser = Awaited<ReturnType<typeof sdkClient.getUser>>;

/** `null` when the person has no OneSignal user yet. */
async function findUser(slug: string): Promise<OneSignalUser | null> {
  try {
    return await sdkClient.getUser(getAppId(), 'external_id', slug);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Returns the person's OneSignal user, creating it by `external_id` when absent. The browser SDK's
 * `login(slug)` adopts the user with that `external_id`, so both paths end on one user.
 */
async function ensureUser(slug: string): Promise<OneSignalUser> {
  const existing = await findUser(slug);
  if (existing) return existing;
  try {
    return await sdkClient.createUser(getAppId(), {
      identity: { external_id: slug },
      properties: { tags: {} },
    });
  } catch (error) {
    // Lost a race with the SDK's own `login(slug)`: the user exists now.
    const raced = await findUser(slug);
    if (raced) return raced;
    throw error;
  }
}

/** `''` removes a tag in OneSignal; a batched PATCH merges, it does not replace the tag set. */
const REMOVE_TAG = '';

function preferenceTagValue(enabled: boolean): string {
  return enabled ? REMOVE_TAG : TAG_VALUE_DISABLED;
}

async function writeTags(slug: string, tags: Record<string, string>) {
  if (Object.keys(tags).length === 0) return;
  await sdkClient.updateUser(getAppId(), 'external_id', slug, {
    properties: { tags },
  });
}

function toPreferences(
  tags: Record<string, string> | undefined,
): NotificationPreferences {
  const t = tags ?? {};
  return {
    subscribed: t[TAG_SUBSCRIBED] === 'true',
    pushTagEnabled: !isTagDisabled(t[TAG_PUSH]),
    emailEnabled: !isTagDisabled(t[TAG_EMAIL]),
    subscriptions: SUBSCRIPTION_TAGS.map((name) => ({
      name,
      value: !isTagDisabled(t[name]),
    })),
  };
}

/** A person with no OneSignal user yet is simply not enrolled (defaults apply, #2549 D4). */
export async function getNotificationPreferences(
  slug: string,
): Promise<NotificationPreferences> {
  const user = await findUser(slug);
  return toPreferences(user?.properties?.tags);
}

/**
 * Master switch on (#2549 D6/D25): writes `subscribed`, and starts own-action confirmations
 * switched off (D5) without overwriting a choice the person already made. No push prompt involved.
 */
export async function enrolNotifications(
  slug: string,
): Promise<NotificationPreferences> {
  const user = await ensureUser(slug);
  const existing = user.properties?.tags ?? {};
  const tags: Record<string, string> = { [TAG_SUBSCRIBED]: 'true' };
  if (!Object.hasOwn(existing, TAG_SUB_OWN_ACTIONS)) {
    tags[TAG_SUB_OWN_ACTIONS] = TAG_VALUE_DISABLED;
  }
  await writeTags(slug, tags);
  return toPreferences({ ...existing, ...tags });
}

export async function unenrolNotifications(
  slug: string,
): Promise<NotificationPreferences> {
  const user = await ensureUser(slug);
  const tags = { [TAG_SUBSCRIBED]: 'false' };
  await writeTags(slug, tags);
  return toPreferences({ ...(user.properties?.tags ?? {}), ...tags });
}

/**
 * Email follows the `email` switch: on makes sure an enabled Email subscription exists for the
 * person's address (re-enabling one that was left unsubscribed, #2510); off removes it.
 */
async function syncEmailSubscription(
  user: OneSignalUser,
  slug: string,
  email: string | undefined,
  enabled: boolean,
) {
  if (!email) return;
  const appId = getAppId();
  const match = (user.subscriptions ?? []).find(
    (s) => s.type === 'Email' && s.token?.toLowerCase() === email.toLowerCase(),
  );
  if (enabled) {
    if (!match) {
      await sdkClient.createSubscription(appId, 'external_id', slug, {
        subscription: { type: 'Email', token: email, enabled: true },
      });
    } else if (match.enabled === false && match.id) {
      await sdkClient.updateSubscription(appId, match.id, {
        subscription: { enabled: true },
      });
    }
  } else if (match?.id) {
    await sdkClient.deleteSubscription(appId, match.id);
  }
}

export async function saveNotificationPreferences(
  slug: string,
  email: string | undefined,
  update: NotificationPreferencesUpdate,
): Promise<NotificationPreferences> {
  const user = await ensureUser(slug);
  const tags: Record<string, string> = {
    [TAG_EMAIL]: preferenceTagValue(update.emailEnabled),
  };
  if (update.pushTagEnabled !== undefined) {
    tags[TAG_PUSH] = preferenceTagValue(update.pushTagEnabled);
  }
  for (const { name, value } of update.subscriptions) {
    // Only the known preference groups can be written from a client request.
    if (SUBSCRIPTION_TAG_NAMES.includes(name)) {
      tags[name] = preferenceTagValue(value);
    }
  }
  await writeTags(slug, tags);
  await syncEmailSubscription(user, slug, email, update.emailEnabled);

  const merged: Record<string, string> = { ...(user.properties?.tags ?? {}) };
  for (const [name, value] of Object.entries(tags)) {
    if (value === REMOVE_TAG) delete merged[name];
    else merged[name] = value;
  }
  return toPreferences(merged);
}
