/**
 * Shared HTML layout for code-owned notification emails (#2549 D2), extracted from the validated
 * OneSignal dashboard templates (dark Hypha header, centred card, CTA button, grey footer). Every
 * email renders through `layout()` so greeting/CTA/footer stay aligned.
 *
 * Dynamic text must go through `escapeHtml` (the `paragraph`/`strong`/`preview`/`button` helpers
 * do it for you). `[unsubscribe_url]` is a OneSignal token resolved at send time.
 */
export const UNSUBSCRIBE_TOKEN = '[unsubscribe_url]';
export const SUPPORT_EMAIL = 'support@hypha.earth';
export const LOGO_PATH = '/brand/hypha-logo-white.png';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `http(s)` URLs pass through; anything else (e.g. `javascript:`) becomes `#`. */
export function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : '#';
  } catch {
    return '#';
  }
}

/** `<strong>` with escaped text, for composing inside `paragraphHtml`. */
export function strong(text: string): string {
  return `<strong>${escapeHtml(text)}</strong>`;
}

/** Paragraph from already-safe inner HTML (compose with `escapeHtml` / `strong`). */
export function paragraphHtml(innerHtml: string): string {
  return `<p>${innerHtml}</p>`;
}

/** Paragraph from plain text (escaped). */
export function paragraph(text: string): string {
  return paragraphHtml(escapeHtml(text));
}

/** Small grey paragraph from safe inner HTML (e.g. a copy-paste fallback link). */
export function muted(innerHtml: string): string {
  return `<p class="muted">${innerHtml}</p>`;
}

/** Left-aligned numbered list from safe inner-HTML items. */
export function steps(itemsHtml: string[]): string {
  return `<ol class="steps">${itemsHtml
    .map((item) => `<li>${item}</li>`)
    .join('')}</ol>`;
}

/** Grey quoted block, e.g. a chat message preview. */
export function preview(text: string): string {
  return `<p class="preview">${escapeHtml(text)}</p>`;
}

export function button(label: string, url: string): string {
  return `<p><a class="cta" href="${escapeHtml(url)}">${escapeHtml(
    label,
  )}</a></p>`;
}

export interface LayoutInput {
  /** `<title>` of the document. */
  title: string;
  /** Inbox preview text. Sent as `email_preheader` (OneSignal injects the hidden preview span), not rendered here. */
  preheader?: string;
  /** Opening line; `null` omits it. Defaults to "Hey there,". */
  greeting?: string | null;
  /** Plain-text paragraphs (escaped by the layout). */
  paragraphs?: string[];
  /** Pre-built safe HTML (from the helpers above), rendered after `paragraphs`. */
  contentHtml?: string;
  cta?: { label: string; url: string };
  /** Closing line; `null` omits it. Defaults to "With gratitude, Hypha". */
  signoff?: string | null;
  footer?: {
    /** "Manage notification settings" button; omitted when unknown. */
    settingsUrl?: string;
    /** Subscription-based emails carry the unsubscribe link; transactional ones (e.g. KYB) don't. */
    unsubscribe?: boolean;
  };
  /** Absolute app origin for the hosted logo, e.g. `https://app.hypha.earth`. */
  appUrl?: string;
}

const STYLES = [
  'body{font-family:Arial,sans-serif;color:#333;background-color:#f9f9f9;margin:0;padding:0}',
  '.container{max-width:600px;margin:0 auto;background-color:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1)}',
  '.header{background-color:#03081B;color:#fff;text-align:center;padding:20px 20px 10px}',
  '.content{padding:30px;text-align:center;font-size:16px;line-height:1.6}',
  '.preview{margin:16px 0;padding:12px 16px;background-color:#f1f1f1;border-radius:8px;color:#444;font-size:15px;line-height:1.5;text-align:left}',
  '.cta{display:inline-block;padding:12px 24px;background-color:#03081B;color:#fff !important;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px}',
  '.muted{font-size:13px;color:#888}',
  '.steps{text-align:left;max-width:440px;margin:20px auto 0;padding-left:20px}',
  '.steps li{margin-bottom:14px;line-height:1.5}',
  '.footer{background-color:#f1f1f1;text-align:center;padding:15px;font-size:12px;color:#666}',
  'a{color:#03081B;text-decoration:none}',
  '.footer-btn{display:inline-block;padding:8px 16px;background-color:#03081B;color:#fff !important;border-radius:4px;text-decoration:none;font-size:12px;margin-top:10px}',
].join('');

export function layout({
  title,
  greeting = 'Hey there,',
  paragraphs = [],
  contentHtml = '',
  cta,
  signoff = 'With gratitude, Hypha',
  footer = {},
  appUrl = 'https://app.hypha.earth',
}: LayoutInput): string {
  const body = [
    greeting === null ? '' : paragraph(greeting),
    ...paragraphs.map(paragraph),
    contentHtml,
    cta ? button(cta.label, cta.url) : '',
    signoff === null ? '' : paragraph(signoff),
  ].join('');

  const footerHtml = [
    `<p>Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`,
    footer.settingsUrl
      ? `<p><a href="${escapeHtml(
          footer.settingsUrl,
        )}" class="footer-btn">Manage notification settings</a></p>`
      : '',
    footer.unsubscribe
      ? `<p style="font-size:12px;"><a href="${UNSUBSCRIBE_TOKEN}" style="text-decoration:underline;color:#444;">Unsubscribe from all emails</a></p>`
      : '',
    '<p>© Hypha. All rights reserved.</p>',
  ].join('');

  return [
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>`,
    '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f9f9f9;"><tr><td align="center">',
    '<table class="container" width="600" border="0" cellspacing="0" cellpadding="0">',
    `<tr><td class="header"><img width="200" height="68" alt="Hypha" style="display:block;margin:0 auto;border:0;" src="${escapeHtml(
      appUrl.replace(/\/+$/, '') + LOGO_PATH,
    )}" /></td></tr>`,
    `<tr><td class="content">${body}</td></tr>`,
    `<tr><td class="footer">${footerHtml}</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join('');
}
