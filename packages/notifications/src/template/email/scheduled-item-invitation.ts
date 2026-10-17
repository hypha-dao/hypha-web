import type { Email } from './types';
import {
  button,
  escapeHtml,
  layout,
  muted,
  paragraph,
  paragraphHtml,
  preview,
  safeHref,
  strong,
} from '../common/layout';

/**
 * Meeting / scheduled-item invitation. Content is identical for every recipient so `dispatch()`
 * can group them into one send — keep it recipient-independent.
 */
export function emailScheduledItemInvitation({
  title,
  spaceTitle,
  whenLabel,
  joinUrl,
  description,
  settingsUrl,
  appUrl,
}: {
  title: string;
  spaceTitle: string;
  whenLabel: string;
  joinUrl: string;
  description?: string | null;
  settingsUrl?: string;
  appUrl?: string;
}): Email {
  const subject = `Invitation: ${title}`;
  const preheader = `${title} · ${whenLabel}`;
  const href = safeHref(joinUrl);
  const space = spaceTitle.trim();

  const body = layout({
    title: subject,
    preheader,
    appUrl,
    contentHtml: [
      paragraphHtml(
        `You&rsquo;re invited to ${strong(title)}${
          space ? ` in ${strong(space)}` : ''
        }.`,
      ),
      paragraph(whenLabel),
      description?.trim() ? preview(description.trim()) : '',
      button('Join meeting', href),
      muted(`Or copy this link:<br />${escapeHtml(href)}`),
    ].join(''),
    footer: {
      unsubscribe: true,
      settingsUrl: settingsUrl ? safeHref(settingsUrl) : undefined,
    },
  });

  return { subject, preheader, body };
}
