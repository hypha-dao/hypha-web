'use client';

import type { ReactNode } from 'react';

const TRAILING_PUNCT = new Set([',', ')', '.', ';', ':', '!', '?']);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isUrlBoundary(s: string, i: number): boolean {
  if (i <= 0) return true;
  const prev = s[i - 1]!;
  return (
    prev === ' ' ||
    prev === '\t' ||
    prev === '\n' ||
    prev === '(' ||
    prev === '[' ||
    prev === '<' ||
    prev === '"' ||
    prev === "'"
  );
}

function trimUrlMatch(raw: string): string {
  let end = raw.length;
  while (end > 0 && TRAILING_PUNCT.has(raw[end - 1]!)) {
    end -= 1;
  }
  return raw.slice(0, end);
}

function readMarkdownLinkRaw(s: string, i: number): number {
  if (s[i] !== '[') return -1;
  if (i > 0 && s[i - 1] === '!') return -1;
  const labelStart = i + 1;
  let labelEnd = labelStart;
  while (labelEnd < s.length) {
    const ch = s[labelEnd];
    if (ch === '\n' || ch === ']') break;
    labelEnd += 1;
  }
  if (labelEnd >= s.length || s[labelEnd] !== ']') return -1;
  if (labelEnd === labelStart) return -1;
  if (s[labelEnd + 1] !== '(') return -1;
  const urlStart = labelEnd + 2;
  let urlEnd = urlStart;
  while (urlEnd < s.length) {
    const ch = s[urlEnd];
    if (ch === '\n' || ch === ')' || ch === ' ' || ch === '\t') break;
    urlEnd += 1;
  }
  if (urlEnd >= s.length || s[urlEnd] !== ')' || urlEnd === urlStart) {
    return -1;
  }
  return urlEnd + 1;
}

function readAutolinkRaw(s: string, i: number): number {
  if (!isUrlBoundary(s, i)) return -1;
  let prefixLen = 0;
  if (s.startsWith('https://', i)) prefixLen = 8;
  else if (s.startsWith('http://', i)) prefixLen = 7;
  else if (s.startsWith('www.', i)) prefixLen = 4;
  else return -1;
  let end = i + prefixLen;
  while (end < s.length) {
    const ch = s[end]!;
    if (
      ch === ' ' ||
      ch === '\t' ||
      ch === '\n' ||
      ch === '<' ||
      ch === '>' ||
      ch === '"' ||
      ch === "'"
    ) {
      break;
    }
    end += 1;
  }
  if (end <= i + prefixLen) return -1;
  const trimmed = trimUrlMatch(s.slice(i, end));
  if (trimmed.length <= prefixLen) return -1;
  return i + trimmed.length;
}

const linkClassName =
  'font-medium text-primary underline decoration-primary/50 underline-offset-2';

/**
 * Inline nodes for the mirrored backdrop (styled URLs and `[title](url)`).
 * Spans keep the same characters as the textarea so caret alignment holds.
 */
export function highlightComposerUrlsForBackdrop(plain: string): ReactNode[] {
  if (!plain) return [];

  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const pushText = (value: string) => {
    if (!value) return;
    parts.push(<span key={`t-${key++}`}>{escapeHtml(value)}</span>);
  };

  while (i < plain.length) {
    const mdEnd = readMarkdownLinkRaw(plain, i);
    if (mdEnd > i) {
      parts.push(
        <span key={`m-${key++}`} className={linkClassName}>
          {escapeHtml(plain.slice(i, mdEnd))}
        </span>,
      );
      i = mdEnd;
      continue;
    }
    const urlEnd = readAutolinkRaw(plain, i);
    if (urlEnd > i) {
      parts.push(
        <span key={`u-${key++}`} className={linkClassName}>
          {escapeHtml(plain.slice(i, urlEnd))}
        </span>,
      );
      i = urlEnd;
      continue;
    }
    let next = i + 1;
    while (next < plain.length) {
      if (readMarkdownLinkRaw(plain, next) > next) break;
      if (readAutolinkRaw(plain, next) > next) break;
      next += 1;
    }
    pushText(plain.slice(i, next));
    i = next;
  }

  return parts;
}
