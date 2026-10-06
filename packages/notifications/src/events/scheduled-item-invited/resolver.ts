import { resolveScheduledItemJoinUrl } from '@hypha-platform/core/client';
import type { ScheduledItem } from '@hypha-platform/core/client';
import {
  resolveScheduledItemRecipientSlugs,
  toAbsoluteAppUrl,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { Recipient, ScheduledItemInvitedEvent } from '../../core/types';

export function buildScheduledItemInvitedEvent(input: {
  item: ScheduledItem;
  spaceSlug: string;
  spaceTitle: string;
  channels: Array<'email' | 'push'>;
  lang?: string;
}): ScheduledItemInvitedEvent {
  const lang = input.lang?.trim() || 'en';
  const joinPathOrUrl = resolveScheduledItemJoinUrl(
    input.item,
    lang,
    input.spaceSlug,
  );
  const joinUrl = joinPathOrUrl
    ? joinPathOrUrl.startsWith('http')
      ? joinPathOrUrl
      : toAbsoluteAppUrl(joinPathOrUrl)
    : toAbsoluteAppUrl(`/${lang}/dho/${input.spaceSlug}/calendar`);

  return {
    type: 'scheduled_item.invited',
    source: {
      kind: 'domain',
      entityType: 'scheduled_item',
      entityId: String(input.item.id),
    },
    context: { item: input.item },
    payload: {
      title: input.item.title,
      description: input.item.description,
      spaceTitle: input.spaceTitle,
      startsAt: input.item.startsAt,
      endsAt: input.item.endsAt,
      timezone: input.item.timezone,
      joinUrl,
      channels: input.channels,
      lang,
    },
  };
}

/** Signal assignees when the item is linked to a coherence, otherwise every space member — unchanged from `resolveScheduledItemRecipientSlugs`, which this just wraps. Creator always excluded. */
export const resolveScheduledItemInvitedRecipients: RecipientResolver<
  ScheduledItemInvitedEvent
> = async (event) => {
  const slugs = await resolveScheduledItemRecipientSlugs(
    event.context.item,
    { db },
    { excludeCreator: true },
  );
  return slugs.map((personSlug): Recipient => ({ personSlug, role: 'member' }));
};
