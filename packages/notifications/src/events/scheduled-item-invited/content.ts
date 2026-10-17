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
import { emailScheduledItemInvitation } from '../../template';

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
  const invitation = emailScheduledItemInvitation({
    title: title.trim(),
    spaceTitle: spaceTitle.trim(),
    whenLabel,
    joinUrl: safeJoinUrl,
    description,
    settingsUrl: event.payload.settingsUrl,
  });

  return {
    channels,
    requiredTags: [TAG_MEETING_CONSENT],
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
            subject: invitation.subject,
            preheader: invitation.preheader,
            body: invitation.body,
          }
        : undefined,
    },
  };
};
