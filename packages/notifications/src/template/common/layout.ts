/**
 * Shared HTML layout for code-owned notification emails (#2549 D2). Every email renders through
 * `layout()` so greeting/CTA/footer stay aligned. All dynamic text is HTML-escaped here.
 *
 * `[unsubscribe_url]` is a OneSignal substitution token resolved at send time.
 */
export const UNSUBSCRIBE_TOKEN = '[unsubscribe_url]';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2937;">${escapeHtml(
    text,
  )}</p>`;
}

export function button(label: string, url: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(
    url,
  )}" style="display:inline-block;padding:12px 24px;background:#5a4cff;color:#ffffff;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;">${escapeHtml(
    label,
  )}</a></p>`;
}

export interface LayoutInput {
  /** Inbox preview text. */
  preheader?: string;
  title: string;
  /** Plain-text paragraphs (escaped by the layout). */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Footer "manage notification settings" link; omitted when unknown. */
  settingsUrl?: string;
}

export function layout({
  preheader,
  title,
  paragraphs,
  cta,
  settingsUrl,
}: LayoutInput): string {
  const footerLinks = [
    settingsUrl
      ? `<a href="${escapeHtml(settingsUrl)}" style="color:#6b7280;">Manage notification settings</a>`
      : undefined,
    `<a href="${UNSUBSCRIBE_TOKEN}" style="color:#6b7280;">Unsubscribe</a>`,
  ].filter(Boolean);

  return [
    '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">',
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
      : '',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;"><tr><td style="padding:32px;">',
    `<h1 style="margin:0 0 24px;font-size:22px;line-height:28px;color:#111827;">${escapeHtml(title)}</h1>`,
    ...paragraphs.map(paragraph),
    cta ? button(cta.label, cta.url) : '',
    `<p style="margin:32px 0 0;font-size:12px;line-height:18px;color:#6b7280;">${footerLinks.join(' · ')}</p>`,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}
