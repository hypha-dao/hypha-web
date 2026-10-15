import type { Email } from './types';
import {
  layout,
  paragraph,
  paragraphHtml,
  preview,
  safeHref,
  strong,
} from '../common/layout';

/** Chat mention email: subscription-based, so it carries the settings link and unsubscribe. */
export function emailChatMention({
  actorName = 'Someone',
  messagePreview,
  url,
  contextLabel,
  settingsUrl,
  appUrl,
}: {
  actorName?: string;
  messagePreview?: string;
  url: string;
  contextLabel?: string;
  settingsUrl?: string;
  appUrl?: string;
}): Email {
  const context = contextLabel?.trim() || 'chat';
  const previewText = messagePreview?.trim() ?? '';
  const subject = `${actorName} mentioned you`;
  const preheader = previewText || `${actorName} mentioned you in ${context}.`;

  const body = layout({
    title: subject,
    preheader,
    appUrl,
    contentHtml: [
      paragraphHtml(
        `${strong(actorName)} mentioned you in ${strong(context)}. 💬`,
      ),
      previewText ? preview(previewText) : '',
      paragraph('Jump back in to read the full message and reply.'),
    ].join(''),
    cta: { label: 'View Mention', url: safeHref(url) },
    footer: {
      unsubscribe: true,
      settingsUrl: settingsUrl ? safeHref(settingsUrl) : undefined,
    },
  });

  return { subject, preheader, body };
}
