import 'server-only';

import {
  buildScheduledCallJoinPath,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { TAG_MEETING_CONSENT } from '../constants/tags';
import { toAbsoluteAppUrl } from '@hypha-platform/core/server';
import { sendEmailNotifications, sendPushNotifications } from '../mutations';

export type NotifyScheduledItemReminderInput = {
  item: ScheduledItem;
  occurrenceStartsAt: Date;
  spaceSlug: string;
  spaceTitle: string;
  memberSlugs: string[];
  channels: Array<'email' | 'push'>;
  lang?: string;
};

function buildReminderUrl(input: NotifyScheduledItemReminderInput): string {
  const lang = input.lang?.trim() || 'en';
  if (
    input.item.matrixAutoLink &&
    (input.item.type === 'call' || input.item.type === 'meeting')
  ) {
    return toAbsoluteAppUrl(buildScheduledCallJoinPath(lang, input.spaceSlug));
  }
  if (input.item.meetingUrl?.trim()) {
    return input.item.meetingUrl.trim();
  }
  return toAbsoluteAppUrl(`/${lang}/dho/${input.spaceSlug}/calendar`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeReminderUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://placeholder.local');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '#';
    }
    return parsed.toString();
  } catch {
    return '#';
  }
}

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

export async function notifyScheduledItemReminder(
  input: NotifyScheduledItemReminderInput,
) {
  if (input.memberSlugs.length === 0) return { sent: 0 };

  const lang = input.lang?.trim() || 'en';
  const whenLabel = formatReminderWhen(
    input.occurrenceStartsAt,
    lang,
    input.item.timezone,
  );
  const title = input.item.title.trim();
  const spaceTitle = input.spaceTitle.trim();
  const url = buildReminderUrl(input);
  const safeTitle = escapeHtml(title);
  const safeSpaceTitle = escapeHtml(spaceTitle);
  const safeUrl = sanitizeReminderUrl(url);
  const pushUrl = safeUrl === '#' ? undefined : safeUrl;
  const heading = `${title} starts soon`;
  const pushBody = `${title} starts at ${whenLabel}`;
  const body = `<p><strong>${safeTitle}</strong> in <strong>${safeSpaceTitle}</strong> starts at ${whenLabel}.</p><p><a href="${safeUrl}">Open in Hypha</a></p>`;
  const textBody = `${title} in ${spaceTitle} starts at ${whenLabel}. Open: ${url}`;

  let sent = 0;

  if (input.channels.includes('push')) {
    await sendPushNotifications({
      usernames: input.memberSlugs,
      headings: { en: heading },
      contents: { en: pushBody },
      url: pushUrl,
      requiredTags: { [TAG_MEETING_CONSENT]: 'true' },
    });
    sent += 1;
  }

  if (input.channels.includes('email')) {
    await sendEmailNotifications({
      usernames: input.memberSlugs,
      subject: heading,
      body,
      requiredTags: { [TAG_MEETING_CONSENT]: 'true' },
    });
    sent += 1;
  }

  return { sent, url, textBody };
}
