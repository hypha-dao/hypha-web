/**
 * Pure content-selection for `scheduled_item.invited` — no DB/web3 imports; `resolver.ts`
 * precomputes `joinUrl` (it needs `server-only` URL helpers this file avoids, to stay cheaply
 * unit-testable). Content is identical for every recipient (no personalization), matching
 * `notify-scheduled-item-invitation.ts`'s prior single-batched-call behavior — `dispatch()`'s
 * identical-content grouping reproduces that automatically.
 */
import type { ContentBuilder } from '../../core/content-builder';
import type { ScheduledItemInvitedEvent } from '../../core/types';
import { TAG_MEETING_CONSENT } from '../../constants/tags';

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
  /** Already sanitized by the caller — sanitizing again here would re-resolve a `'#'` fallback against a placeholder base and produce a broken-looking absolute URL (a bug in the code this was re-derived from). */
  joinUrl: string;
  description?: string | null;
}): string {
  const safeTitle = escapeHtml(input.title);
  const safeSpace = escapeHtml(input.spaceTitle);
  const safeWhen = escapeHtml(input.whenLabel);
  const safeUrl = escapeHtml(input.joinUrl);
  const safeDescription = input.description?.trim()
    ? `<p style="margin:16px 0 0;color:#555;">${escapeHtml(
        input.description.trim(),
      )}</p>`
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

export const buildScheduledItemInvitedContent: ContentBuilder<
  ScheduledItemInvitedEvent
> = (event) => {
  const {
    title,
    description,
    spaceTitle,
    startsAt,
    endsAt,
    timezone,
    joinUrl,
    channels,
    lang,
  } = event.payload;
  const safeJoinUrl = sanitizeUrl(joinUrl);
  const pushUrl = safeJoinUrl === '#' ? undefined : safeJoinUrl;
  const whenLabel = formatWhen(startsAt, endsAt, lang, timezone);
  const heading = `Invitation: ${title.trim()}`;

  return {
    channels,
    requiredTags: { [TAG_MEETING_CONSENT]: 'true' },
    content: {
      push: channels.includes('push')
        ? {
            kind: 'plain',
            headings: { en: heading },
            contents: { en: `${title.trim()} · ${whenLabel}` },
            url: pushUrl,
          }
        : undefined,
      email: channels.includes('email')
        ? {
            kind: 'plain',
            subject: heading,
            body: buildInvitationEmailBody({
              title: title.trim(),
              spaceTitle: spaceTitle.trim(),
              whenLabel,
              joinUrl: safeJoinUrl,
              description,
            }),
          }
        : undefined,
    },
  };
};
