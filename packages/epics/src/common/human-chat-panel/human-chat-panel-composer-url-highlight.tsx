'use client';

import type { ReactNode } from 'react';

/**
 * Detect pasted/typed URLs in plain text for Discord-style composer highlighting.
 */
const COMPOSER_AUTOLINK_RE = /\b(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TRAILING_PUNCT = new Set([',', ')', '.', ';', ':']);

/** Trim common trailing punctuation from URL matches (linear; avoid ReDoS-prone regex). */
function trimUrlMatch(raw: string): string {
  let end = raw.length;
  while (end > 0 && TRAILING_PUNCT.has(raw[end - 1]!)) {
    end -= 1;
  }
  return raw.slice(0, end);
}

/**
 * Inline nodes for the mirrored backdrop (styled URLs like Discord).
 */
export function highlightComposerUrlsForBackdrop(plain: string): ReactNode[] {
  if (!plain) return [];

  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(
    COMPOSER_AUTOLINK_RE.source,
    COMPOSER_AUTOLINK_RE.flags,
  );

  for (;;) {
    re.lastIndex = last;
    const m = re.exec(plain);
    if (!m) break;
    let url = m[0];
    const idx = m.index;
    const trimmed = trimUrlMatch(url);
    const trimLen = url.length - trimmed.length;
    url = trimmed;

    if (idx > last) {
      parts.push(
        <span key={`t-${key++}`}>{escapeHtml(plain.slice(last, idx))}</span>,
      );
    }

    parts.push(
      <span
        key={`u-${key++}`}
        className="font-medium text-primary underline decoration-primary/50 underline-offset-2"
      >
        {escapeHtml(url)}
      </span>,
    );

    last = idx + url.length + trimLen;
  }

  if (last < plain.length) {
    parts.push(<span key={`t-${key++}`}>{escapeHtml(plain.slice(last))}</span>);
  }

  return parts;
}
