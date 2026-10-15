import type { Email } from './types';
import {
  button,
  escapeHtml,
  layout,
  muted,
  paragraphHtml,
  safeHref,
  strong,
} from '../common/layout';

interface MeetingEmailLinks {
  settingsUrl?: string;
  appUrl?: string;
}

function meetingFooter(settingsUrl?: string) {
  return {
    unsubscribe: true,
    settingsUrl: settingsUrl ? safeHref(settingsUrl) : undefined,
  };
}

/** Someone started a call; gated on `consent_meetings`. */
export function emailCallStarted({
  actorName = 'Someone',
  contextLabel,
  url,
  settingsUrl,
  appUrl,
}: MeetingEmailLinks & {
  actorName?: string;
  contextLabel?: string;
  url: string;
}): Email {
  const context = contextLabel?.trim() || 'chat';
  const subject = `${actorName} started a call`;
  const preheader = `Join the call in ${context}.`;
  const href = safeHref(url);

  const body = layout({
    title: subject,
    preheader,
    appUrl,
    contentHtml:
      paragraphHtml(
        `${strong(actorName)} started a call in ${strong(context)}. 📞`,
      ) +
      button('Join call', href) +
      muted(`Or copy this link:<br />${escapeHtml(href)}`),
    footer: meetingFooter(settingsUrl),
  });

  return { subject, preheader, body };
}

/** A scheduled call/meeting/event is about to start. */
export function emailScheduledItemReminder({
  title,
  spaceTitle,
  whenLabel,
  url,
  settingsUrl,
  appUrl,
}: MeetingEmailLinks & {
  title: string;
  spaceTitle: string;
  whenLabel: string;
  url: string;
}): Email {
  const subject = `${title} starts soon`;
  const preheader = `${title} starts at ${whenLabel}`;
  const href = safeHref(url);
  const space = spaceTitle.trim();

  const body = layout({
    title: subject,
    preheader,
    appUrl,
    contentHtml:
      paragraphHtml(
        `${strong(title)}${
          space ? ` in ${strong(space)}` : ''
        } starts at ${strong(whenLabel)}. ⏰`,
      ) +
      button('Join now', href) +
      muted(`Or copy this link:<br />${escapeHtml(href)}`),
    footer: meetingFooter(settingsUrl),
  });

  return { subject, preheader, body };
}
