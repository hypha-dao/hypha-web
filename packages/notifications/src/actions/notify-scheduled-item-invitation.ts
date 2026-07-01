import 'server-only';

import type { ScheduledItem } from '@hypha-platform/core/client';
import { resolveScheduledItemJoinUrl } from '@hypha-platform/core/client';
import { TAG_MEETING_CONSENT } from '../constants/tags';
import { toAbsoluteAppUrl } from '@hypha-platform/core/server';
import { sendEmailNotifications, sendPushNotifications } from '../mutations';

export type NotifyScheduledItemInvitationInput = {
  item: ScheduledItem;
  spaceSlug: string;
  spaceTitle: string;
  memberSlugs: string[];
  channels: Array<'email' | 'push'>;
  lang?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
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

function formatWhen(
  startsAt: Date,
  endsAt: Date,
  lang: string,
  timezone?: string | null,
): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone?.trim() || undefined,
  };
  const startLabel = new Intl.DateTimeFormat(lang, options).format(startsAt);
  const endTime = new Intl.DateTimeFormat(lang, {
    timeStyle: 'short',
    timeZone: timezone?.trim() || undefined,
  }).format(endsAt);
  return `${startLabel} – ${endTime}`;
}

function buildInvitationEmailBody(input: {
  title: string;
  spaceTitle: string;
  whenLabel: string;
  joinUrl: string;
  description?: string | null;
}): string {
  const safeTitle = escapeHtml(input.title);
  const safeSpace = escapeHtml(input.spaceTitle);
  const safeWhen = escapeHtml(input.whenLabel);
  const safeUrl = sanitizeUrl(input.joinUrl);
  const safeDescription = input.description?.trim()
    ? `<p style="margin:16px 0 0;color:#555;">${escapeHtml(input.description.trim())}</p>`
    : '';

  return `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;">
  <p style="margin:0 0 8px;font-size:14px;color:#555;">${safeSpace}</p>
  <h1 style="margin:0 0 12px;font-size:22px;">You're invited: ${safeTitle}</h1>
  <p style="margin:0 0 20px;font-size:15px;color:#333;">${safeWhen}</p>
  <p style="margin:0 0 24px;">
    <a href="${safeUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;">Join meeting</a>
  </p>
  <p style="margin:0;font-size:13px;color:#666;">Or copy this link:<br><a href="${safeUrl}" style="color:#6d28d9;word-break:break-all;">${safeUrl}</a></p>
  ${safeDescription}
</div>`;
}

export async function notifyScheduledItemInvitation(
  input: NotifyScheduledItemInvitationInput,
) {
  if (input.memberSlugs.length === 0) return { sent: 0 };

  const lang = input.lang?.trim() || 'en';
  const title = input.item.title.trim();
  const spaceTitle = input.spaceTitle.trim();
  const whenLabel = formatWhen(
    input.item.startsAt,
    input.item.endsAt,
    lang,
    input.item.timezone,
  );
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
  const safeJoinUrl = sanitizeUrl(joinUrl);
  const pushUrl = safeJoinUrl === '#' ? undefined : safeJoinUrl;
  const heading = `Invitation: ${title}`;
  const pushBody = `${title} · ${whenLabel}`;
  const body = buildInvitationEmailBody({
    title,
    spaceTitle,
    whenLabel,
    joinUrl: safeJoinUrl,
    description: input.item.description,
  });
  const textBody = `${heading}\n${spaceTitle}\n${whenLabel}\nJoin: ${safeJoinUrl}`;

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

  return { sent, url: safeJoinUrl, textBody };
}
