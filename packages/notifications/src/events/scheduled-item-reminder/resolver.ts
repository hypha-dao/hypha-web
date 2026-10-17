import { resolveScheduledItemJoinUrl } from '@hypha-platform/core/client';
import type { ScheduledItem } from '@hypha-platform/core/client';
import { toAbsoluteAppUrl } from '@hypha-platform/core/server';
import { buildNotificationSettingsUrl } from '../../core/notification-settings-url';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { Recipient, ScheduledItemReminderEvent } from '../../core/types';

function formatReminderWhen(
  occurrenceStartsAt: Date,
  lang: string,
  timezone?: string | null,
): string {
  return new Intl.DateTimeFormat(lang, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone?.trim() || undefined,
  }).format(occurrenceStartsAt);
}

export function buildScheduledItemReminderUrl(input: {
  item: ScheduledItem;
  spaceSlug: string;
  lang?: string;
}): string {
  const lang = input.lang?.trim() || 'en';
  const joinPathOrUrl = resolveScheduledItemJoinUrl(
    input.item,
    lang,
    input.spaceSlug,
  );
  if (joinPathOrUrl) {
    return joinPathOrUrl.startsWith('http')
      ? joinPathOrUrl
      : toAbsoluteAppUrl(joinPathOrUrl);
  }
  return toAbsoluteAppUrl(`/${lang}/dho/${input.spaceSlug}/calendar`);
}

export function buildScheduledItemReminderEvent(input: {
  item: ScheduledItem;
  occurrenceStartsAt: Date;
  spaceSlug: string;
  spaceTitle: string;
  memberSlugs: string[];
  channels: Array<'email' | 'push'>;
  lang?: string;
}): ScheduledItemReminderEvent {
  const lang = input.lang?.trim() || 'en';
  return {
    type: 'scheduled_item.reminder',
    source: {
      kind: 'domain',
      entityType: 'scheduled_item',
      entityId: `${input.item.id}:${input.occurrenceStartsAt.toISOString()}`,
    },
    context: { memberSlugs: input.memberSlugs, itemType: input.item.type },
    payload: {
      title: input.item.title.trim(),
      spaceTitle: input.spaceTitle.trim(),
      whenLabel: formatReminderWhen(
        input.occurrenceStartsAt,
        lang,
        input.item.timezone,
      ),
      url: buildScheduledItemReminderUrl(input),
      settingsUrl: buildNotificationSettingsUrl(),
      channels: input.channels,
    },
  };
}

/** The caller already resolved (and idempotency-claimed) the member slugs. */
export const resolveScheduledItemReminderRecipients: RecipientResolver<
  ScheduledItemReminderEvent
> = async (event) =>
  event.context.memberSlugs.map(
    (personSlug): Recipient => ({ personSlug, role: 'member' }),
  );
