import type { Email } from './types';
import {
  escapeHtml,
  layout,
  muted,
  paragraphHtml,
  strong,
} from '../common/layout';

/**
 * Internal notice for the Hypha team: someone asked to register an integration
 * client (#2515). Transactional (no settings link, no unsubscribe). Every value
 * comes from the requester, so each one is escaped.
 */
export function emailIntegrationClientRequest({
  clientName,
  slug,
  contactEmail,
  description,
  scopes,
  allowedOrigins,
  requesterName,
  requesterSlug,
  appUrl,
}: {
  clientName: string;
  slug: string;
  contactEmail: string;
  description?: string | null;
  scopes: string[];
  allowedOrigins: string[];
  requesterName: string;
  requesterSlug?: string | null;
  appUrl?: string;
}): Email {
  const subject = `New integration client request: ${clientName}`;
  const preheader = `${requesterName} requested access for ${slug}. Review and approve it in ops.`;

  const field = (label: string, value: string) =>
    `${strong(label)} ${escapeHtml(value)}`;

  const requester = requesterSlug
    ? `${strong(requesterName)} (profile: ${escapeHtml(requesterSlug)})`
    : strong(requesterName);

  const body = layout({
    title: 'New integration client request',
    preheader,
    greeting: null,
    signoff: null,
    appUrl,
    contentHtml: [
      paragraphHtml(`${requester} asked to register an integration client.`),
      paragraphHtml(
        [
          field('Name:', clientName),
          field('Slug:', slug),
          field('Contact:', contactEmail),
          field('Scopes:', scopes.join(', ')),
          field('Allowed origins:', allowedOrigins.join(', ') || '—'),
          field('Description:', description?.trim() || '—'),
        ].join('<br />'),
      ),
      muted(
        `Review and approve with the ops endpoint <code>POST /api/integration/v1/ops/clients/${escapeHtml(
          slug,
        )}/approve</code>. Nothing is issued until you do.`,
      ),
    ].join(''),
  });

  return { subject, preheader, body };
}
