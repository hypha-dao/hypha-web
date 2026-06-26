import 'server-only';

import { format } from 'date-fns';
import {
  buildScheduledCallJoinPath,
  toAbsoluteAppUrl,
  type ScheduledItem,
} from '@hypha-platform/core/client';
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
    return encodeURI(url);
  } catch {
    return '#';
  }
}

export async function notifyScheduledItemReminder(
  input: NotifyScheduledItemReminderInput,
) {
  if (input.memberSlugs.length === 0) return { sent: 0 };

  const whenLabel = format(input.occurrenceStartsAt, 'PPpp');
  const title = input.item.title.trim();
  const spaceTitle = input.spaceTitle.trim();
  const url = buildReminderUrl(input);
  const safeTitle = escapeHtml(title);
  const safeSpaceTitle = escapeHtml(spaceTitle);
  const safeUrl = sanitizeReminderUrl(url);
  const heading = `${title} starts soon`;
  const body = `<p><strong>${safeTitle}</strong> in <strong>${safeSpaceTitle}</strong> starts at ${whenLabel}.</p><p><a href="${safeUrl}">Open in Hypha</a></p>`;
  const textBody = `${title} in ${spaceTitle} starts at ${whenLabel}. Open: ${url}`;

  let sent = 0;

  if (input.channels.includes('push')) {
    await sendPushNotifications({
      usernames: input.memberSlugs,
      headings: { en: heading },
      contents: { en: `${title} starts at ${whenLabel}` },
      url,
    });
    sent += 1;
  }

  if (input.channels.includes('email')) {
    await sendEmailNotifications({
      usernames: input.memberSlugs,
      subject: heading,
      body,
    });
    sent += 1;
  }

  return { sent, url, textBody };
}
