import { sdkClient } from '../sdk';
import { TAG_EMAIL, TAG_PUSH, TAG_SUBSCRIBED } from '../constants';
import type { NotificationChannel, Recipient } from './types';

export interface ConsentTags {
  [tag: string]: string;
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
  const onesignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  if (!onesignalAppId) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }
  if (personSlugs.length === 0) return [];

  const results = await Promise.allSettled(
    personSlugs.map(async (personSlug) => ({
      personSlug,
      user: await sdkClient.getUser(onesignalAppId, 'external_id', personSlug),
    })),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<{ personSlug: string; user: any }> =>
        r.status === 'fulfilled',
    )
    .map((r) => r.value)
    .filter(({ user }) => {
      const tags = user.properties?.tags;
      if (!tags) return false;
      return Object.entries(requiredTags).every(
        ([tag, value]) => Object.hasOwn(tags, tag) && tags[tag] === value,
      );
    })
    .map(({ personSlug }) => personSlug);
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
 * Returns the set of person slugs allowed on each channel.
 */
export async function gateRecipientChannels(
  recipients: Recipient[],
  channels: NotificationChannel[],
  requiredTags: ConsentTags,
): Promise<Map<NotificationChannel, Set<string>>> {
  const slugs = recipients.map((r) => r.personSlug);
  const allowed = new Map<NotificationChannel, Set<string>>();

  await Promise.all(
    channels.map(async (channel) => {
      if (channel === 'in_app') {
        allowed.set(channel, new Set(slugs));
        return;
      }
      const consented = await resolveConsentedSlugs(slugs, {
        ...CHANNEL_BASE_TAGS[channel],
        ...requiredTags,
      });
      allowed.set(channel, new Set(consented));
    }),
  );

  return allowed;
}
