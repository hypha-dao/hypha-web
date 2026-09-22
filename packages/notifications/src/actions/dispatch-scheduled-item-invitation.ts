import 'server-only';

import type { ScheduledItem } from '@hypha-platform/core/client';
import {
  buildScheduledItemInviteRevision,
  releaseScheduledItemInvitationDispatch,
  shouldDispatchScheduledItemInvitation,
  tryClaimScheduledItemInvitationDispatch,
  resolveScheduledItemRecipientSlugs,
  type DbConfig,
} from '@hypha-platform/core/server';
import { dispatch } from '../core/dispatch';
import { buildScheduledItemInvitedEvent } from '../events/scheduled-item-invited';

export async function dispatchScheduledItemInvitation(
  {
    item,
    spaceSlug,
    spaceTitle,
    lang = 'en',
  }: {
    item: ScheduledItem;
    spaceSlug: string;
    spaceTitle: string;
    lang?: string;
  },
  { db }: DbConfig,
): Promise<{ sent: boolean; recipientCount: number }> {
  if (!shouldDispatchScheduledItemInvitation(item)) {
    return { sent: false, recipientCount: 0 };
  }

  const inviteRevision = buildScheduledItemInviteRevision(item);
  const memberSlugs = await resolveScheduledItemRecipientSlugs(
    item,
    { db },
    {
      excludeCreator: true,
    },
  );
  if (memberSlugs.length === 0) {
    return { sent: false, recipientCount: 0 };
  }

  const claimedChannels: Array<'email' | 'push'> = [];
  for (const channel of ['email', 'push'] as const) {
    const claimed = await tryClaimScheduledItemInvitationDispatch(
      { scheduledItemId: item.id, inviteRevision, channel },
      { db },
    );
    if (claimed) claimedChannels.push(channel);
  }

  if (claimedChannels.length === 0) {
    return { sent: false, recipientCount: memberSlugs.length };
  }

  try {
    // One `dispatch()` call per channel: `dispatch()`'s `DispatchResult` is a flat count across
    // however many notifications it grouped, not broken down per channel — calling once per
    // channel keeps the result attributable to that one channel's claim below.
    for (const channel of claimedChannels) {
      const event = buildScheduledItemInvitedEvent({
        item,
        spaceSlug,
        spaceTitle,
        lang,
        channels: [channel],
      });
      const result = await dispatch(event);
      // `null` means nothing to send after consent gating (no one wants this channel) — not a
      // failure, don't release. Only release (allow a retry) on a real delivery failure: sends
      // were attempted and none got through.
      if (result && result.sent === 0 && result.failed > 0) {
        await releaseScheduledItemInvitationDispatch(
          { scheduledItemId: item.id, inviteRevision, channel },
          { db },
        );
      }
    }
    return { sent: true, recipientCount: memberSlugs.length };
  } catch (error) {
    for (const channel of claimedChannels) {
      await releaseScheduledItemInvitationDispatch(
        { scheduledItemId: item.id, inviteRevision, channel },
        { db },
      );
    }
    throw error;
  }
}
