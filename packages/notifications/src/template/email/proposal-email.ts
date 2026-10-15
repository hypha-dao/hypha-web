import type { Email } from './types';
import {
  escapeHtml,
  layout,
  paragraph,
  paragraphHtml,
  safeHref,
} from '../common/layout';

export { strong } from '../common/layout';

/** `“title”` fragment (escaped, with a leading space), or empty when there is no title. */
export function quotedTitleHtml(title?: string): string {
  return title?.trim() ? ` &ldquo;${escapeHtml(title.trim())}&rdquo;` : '';
}

/**
 * Shared shape of every proposal email (created/accepted/rejected × creator/members): one
 * statement paragraph, optional follow-up lines, a "View proposal" CTA and the subscription
 * footer. `statementHtml` must already be escaped (compose with `strong`/`quotedTitleHtml`).
 */
export function proposalEmail({
  subject,
  preheader,
  statementHtml,
  followUps = [],
  greeting,
  url,
  settingsUrl,
  appUrl,
}: {
  subject: string;
  preheader: string;
  statementHtml: string;
  followUps?: string[];
  /** Opening line; defaults to the layout's "Hey there,". */
  greeting?: string;
  url?: string;
  settingsUrl?: string;
  appUrl?: string;
}): Email {
  const body = layout({
    title: subject,
    preheader,
    greeting,
    appUrl,
    contentHtml:
      paragraphHtml(statementHtml) + followUps.map(paragraph).join(''),
    cta: {
      label: 'View proposal',
      url: url ? safeHref(url) : appUrl ?? 'https://app.hypha.earth',
    },
    footer: {
      unsubscribe: true,
      settingsUrl: settingsUrl ? safeHref(settingsUrl) : undefined,
    },
  });
  return { subject, preheader, body };
}
