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
import { notifyScheduledItemInvitation } from './notify-scheduled-item-invitation';

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
  const memberSlugs = await resolveScheduledItemRecipientSlugs(item, { db }, {
    excludeCreator: true,
  });
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
    await notifyScheduledItemInvitation({
      item,
      spaceSlug,
      spaceTitle,
      memberSlugs,
      channels: claimedChannels,
      lang,
    });
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
