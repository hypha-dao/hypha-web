import { sdkClient } from '../sdk';
import { TAG_EMAIL, TAG_PUSH, TAG_SUBSCRIBED } from '../constants';
import type { NotificationChannel, Recipient } from './types';

export interface ConsentTags {
  [tag: string]: string;
}

function tagsMatch(
  tags: Record<string, string> | undefined,
  requiredTags: ConsentTags,
): boolean {
  if (!tags) return false;
  return Object.entries(requiredTags).every(
    ([tag, value]) => Object.hasOwn(tags, tag) && tags[tag] === value,
  );
}

/**
 * Fetches each slug's OneSignal tags once (by `external_id`), regardless of how many channels
 * end up checking them — `gateRecipientChannels` used to call this per channel, turning a
 * multi-channel event (e.g. push + email) into 2x the `getUser` calls for the same recipients.
 */
async function fetchTagsBySlug(
  personSlugs: string[],
): Promise<Map<string, Record<string, string> | undefined>> {
  const tagsBySlug = new Map<string, Record<string, string> | undefined>();
  if (personSlugs.length === 0) return tagsBySlug;

  const onesignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  if (!onesignalAppId) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  const results = await Promise.allSettled(
    personSlugs.map(async (personSlug) => ({
      personSlug,
      user: await sdkClient.getUser(onesignalAppId, 'external_id', personSlug),
    })),
  );
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { personSlug, user } = result.value;
    tagsBySlug.set(personSlug, user.properties?.tags);
  }
  return tagsBySlug;
}

/**
 * Given candidate person slugs and a set of required OneSignal tags, returns the subset whose
 * OneSignal user (looked up by `external_id`) has every tag matching. One place for what
 * `mutations.ts`'s `filterUsers` used to do inline per action — moved here so the decision layer
 * (`gateRecipientChannels` below) and the legacy per-action senders (`mutations.ts`) share one
 * implementation instead of two copies drifting apart.
 */
export async function resolveConsentedSlugs(
  personSlugs: string[],
  requiredTags: ConsentTags,
): Promise<string[]> {
  const tagsBySlug = await fetchTagsBySlug(personSlugs);
  return personSlugs.filter((slug) =>
    tagsMatch(tagsBySlug.get(slug), requiredTags),
  );
}

const CHANNEL_BASE_TAGS: Record<'push' | 'email', ConsentTags> = {
  push: { [TAG_SUBSCRIBED]: 'true', [TAG_PUSH]: 'true' },
  email: { [TAG_SUBSCRIBED]: 'true', [TAG_EMAIL]: 'true' },
};

/**
 * Gates a batch of recipients requesting the same channels + `requiredTags` (the common case —
 * one event's recipients almost always share the same consent requirement). `in_app` has no
 * OneSignal tag gate today (reserved channel, see implementation-plan.md §9) and always passes.
 *
 * Returns the set of person slugs allowed on each channel. Fetches each recipient's OneSignal
 * tags once (via `fetchTagsBySlug`), then evaluates every requested channel's required tags
 * against that same cached set — one lookup per slug regardless of channel count.
 */
export async function gateRecipientChannels(
  recipients: Recipient[],
  channels: NotificationChannel[],
  requiredTags: ConsentTags,
): Promise<Map<NotificationChannel, Set<string>>> {
  const slugs = recipients.map((r) => r.personSlug);
  const allowed = new Map<NotificationChannel, Set<string>>();

  const tagGatedChannels = channels.filter(
    (channel): channel is 'push' | 'email' => channel !== 'in_app',
  );
  const tagsBySlug =
    tagGatedChannels.length > 0
      ? await fetchTagsBySlug(slugs)
      : new Map<string, Record<string, string> | undefined>();

  for (const channel of channels) {
    if (channel === 'in_app') {
      allowed.set(channel, new Set(slugs));
      continue;
    }
    const required = { ...CHANNEL_BASE_TAGS[channel], ...requiredTags };
    const consented = slugs.filter((slug) =>
      tagsMatch(tagsBySlug.get(slug), required),
    );
    allowed.set(channel, new Set(consented));
  }

  return allowed;
}
