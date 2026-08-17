import { isSafeInlineLinkUrl } from '@hypha-platform/ui-utils';

function walkHtmlToChatMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style') return '';
  if (tag === 'br') return '\n';

  const children = Array.from(el.childNodes).map(walkHtmlToChatMarkup).join('');

  if (tag === 'a') {
    const href = (el.getAttribute('href') ?? '').trim();
    const label = children.trim() || href;
    if (isSafeInlineLinkUrl(href) && label) {
      return `[${label}](${href})`;
    }
    return children;
  }

  if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'h1') {
    return children ? `${children}\n` : '';
  }
  return children;
}

/**
 * Turn copied/dropped HTML that contains `<a href>` into chat markdown
 * (`[title](url)`), so the composer and timeline can show real links.
 */
export function htmlToChatLinkMarkup(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (!lower.includes('<a ') && !lower.includes('<a>')) return null;

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');
  const body = doc.body;
  if (!body) return null;
  const out = Array.from(body.childNodes)
    .map(walkHtmlToChatMarkup)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out.includes('[') && out.includes('](') ? out : null;
}

export function firstUriListHref(data: DataTransfer): string | null {
  const uriList = data.getData('text/uri-list');
  if (uriList) {
    const lines = uriList.split(/\r?\n/);
    for (const line of lines) {
      const candidate = line.trim();
      if (
        candidate &&
        !candidate.startsWith('#') &&
        isSafeInlineLinkUrl(candidate)
      ) {
        return candidate;
      }
    }
  }
  const plain = data.getData('text/plain').trim();
  if (
    plain &&
    !/\s/.test(plain) &&
    (plain.startsWith('https://') ||
      plain.startsWith('http://') ||
      plain.startsWith('www.'))
  ) {
    const href = plain.startsWith('www.') ? `https://${plain}` : plain;
    return isSafeInlineLinkUrl(href) ? href : null;
  }
  return null;
}
