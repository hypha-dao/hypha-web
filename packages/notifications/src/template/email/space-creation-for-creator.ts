import type { Email } from './types';
import {
  layout,
  paragraph,
  paragraphHtml,
  safeHref,
  strong,
} from '../common/layout';

/** Dashboard: "Space - Created". Own-action confirmation, gated on `sub_ownActions`. */
export function emailSpaceCreationForCreator({
  spacesCount = 1,
  userName,
  url,
  settingsUrl,
  appUrl,
}: {
  spacesCount?: number;
  userName?: string;
  url?: string;
  settingsUrl?: string;
  appUrl?: string;
} = {}): Email {
  const subject = 'Your space has been created';
  const preheader = 'Welcome to your new space on Hypha.';

  const statementHtml =
    spacesCount > 1
      ? `Great news! You&rsquo;ve successfully created ${strong(
          String(spacesCount),
        )} spaces in the Hypha network. 🚀`
      : 'Great news! You&rsquo;ve successfully created a space in the Hypha network. 🚀';

  const body = layout({
    title: 'Space created',
    preheader,
    greeting: `Hey ${userName?.trim() || 'there'},`,
    appUrl,
    contentHtml:
      paragraphHtml(statementHtml) +
      paragraph('Ready to explore? Keep building! ✨'),
    cta: {
      label: 'Go to my spaces',
      url: url ? safeHref(url) : appUrl ?? 'https://app.hypha.earth',
    },
    footer: {
      unsubscribe: true,
      settingsUrl: settingsUrl ? safeHref(settingsUrl) : undefined,
    },
  });

  return { subject, preheader, body };
}
