/**
 * Discord-like plaintext markup for chat: **bold**, *italic*, ~~strike~~,
 * `code`, ||spoiler||, and > blockquote lines. Used for composer → Matrix HTML
 * and timeline rendering.
 */

import {
  buildRichReplyPlainBody,
  MATRIX_CUSTOM_HTML_FORMAT,
  splitRichReplyPlainBody,
} from './rich-reply';

export type MarkupNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: MarkupNode[] }
  | { type: 'italic'; children: MarkupNode[] }
  | { type: 'strike'; children: MarkupNode[] }
  | { type: 'code'; value: string }
  | { type: 'spoiler'; children: MarkupNode[] }
  | { type: 'linebreak' }
  | { type: 'blockquote'; children: MarkupNode[] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * True if the string uses chat markup delimiters (may still parse to plain text).
 */
export function chatMarkupLooksFormatted(plain: string): boolean {
  if (!plain) return false;
  return (
    /\*\*/.test(plain) ||
    /~~/.test(plain) ||
    /\|\|/.test(plain) ||
    /`/.test(plain) ||
    /(^|\n)>\s?/m.test(plain) ||
    /\*[^*\n]+\*/.test(plain)
  );
}

/**
 * Parse block structure (lines, blockquotes) then inline marks.
 */
export function parseChatMarkup(plain: string): MarkupNode[] {
  const normalized = plain.replace(/\r\n/g, '\n');
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const out: MarkupNode[] = [];
  let i = 0;

  const flushQuote = (quoteLines: string[]) => {
    if (quoteLines.length === 0) return;
    const inner: MarkupNode[] = [];
    for (let q = 0; q < quoteLines.length; q++) {
      if (q > 0) inner.push({ type: 'linebreak' });
      inner.push(...parseInlineMarkup(quoteLines[q]!));
    }
    out.push({ type: 'blockquote', children: inner });
  };

  let quoteBuf: string[] = [];

  while (i < lines.length) {
    const line = lines[i]!;
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      quoteBuf.push(quoteMatch[1] ?? '');
      i += 1;
      continue;
    }
    flushQuote(quoteBuf);
    quoteBuf = [];

    if (line === '' && i < lines.length - 1) {
      out.push({ type: 'linebreak' });
      i += 1;
      continue;
    }
    if (line === '' && i === lines.length - 1) {
      i += 1;
      continue;
    }

    out.push(...parseInlineMarkup(line));
    if (i < lines.length - 1) {
      out.push({ type: 'linebreak' });
    }
    i += 1;
  }

  flushQuote(quoteBuf);
  return out;
}

type DelimKind = 'code' | 'spoiler' | 'bold' | 'strike' | 'italic';

function findNextDelimiter(
  s: string,
  from: number,
): { kind: DelimKind; start: number; endOpen: number } | null {
  let best: { kind: DelimKind; start: number; endOpen: number } | null = null;

  const consider = (kind: DelimKind, start: number, len: number) => {
    if (start < 0) return;
    if (!best || start < best.start) {
      best = { kind, start, endOpen: start + len };
    }
  };

  let idx = from;
  while (idx < s.length) {
    if (s[idx] === '`') {
      consider('code', idx, 1);
      break;
    }
    if (s.slice(idx, idx + 2) === '||') {
      consider('spoiler', idx, 2);
      break;
    }
    if (s.slice(idx, idx + 2) === '**') {
      consider('bold', idx, 2);
      break;
    }
    if (s.slice(idx, idx + 2) === '~~') {
      consider('strike', idx, 2);
      break;
    }
    if (
      s[idx] === '*' &&
      s[idx + 1] !== '*' &&
      (idx === 0 || s[idx - 1] !== '*')
    ) {
      consider('italic', idx, 1);
      break;
    }
    idx += 1;
  }

  return best;
}

function findClosingDelimiter(
  s: string,
  innerStart: number,
  kind: DelimKind,
): { innerEnd: number; len: number } | null {
  switch (kind) {
    case 'code': {
      const i = s.indexOf('`', innerStart);
      return i === -1 ? null : { innerEnd: i, len: 1 };
    }
    case 'spoiler': {
      const i = s.indexOf('||', innerStart);
      return i === -1 ? null : { innerEnd: i, len: 2 };
    }
    case 'bold': {
      const i = s.indexOf('**', innerStart);
      return i === -1 ? null : { innerEnd: i, len: 2 };
    }
    case 'strike': {
      const i = s.indexOf('~~', innerStart);
      return i === -1 ? null : { innerEnd: i, len: 2 };
    }
    case 'italic': {
      for (let i = innerStart; i < s.length; i++) {
        if (s[i] === '*' && s[i + 1] !== '*') {
          return { innerEnd: i, len: 1 };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

function parseInlineMarkup(s: string): MarkupNode[] {
  if (!s) return [];
  const nodes: MarkupNode[] = [];
  let pos = 0;

  while (pos < s.length) {
    const next = findNextDelimiter(s, pos);
    if (!next) {
      if (pos < s.length) {
        nodes.push({ type: 'text', value: s.slice(pos) });
      }
      break;
    }
    if (next.start > pos) {
      nodes.push({ type: 'text', value: s.slice(pos, next.start) });
    }
    const { kind, endOpen } = next;
    const innerStart = endOpen;
    const close = findClosingDelimiter(s, innerStart, kind);
    if (!close) {
      nodes.push({ type: 'text', value: s.slice(next.start, innerStart) });
      pos = innerStart;
      continue;
    }
    const { innerEnd, len } = close;
    const inner = s.slice(innerStart, innerEnd);
    pos = innerEnd + len;

    if (kind === 'code') {
      nodes.push({ type: 'code', value: inner });
    } else {
      const children = parseInlineMarkup(inner);
      const wrap =
        kind === 'bold'
          ? ({ type: 'bold', children } as MarkupNode)
          : kind === 'italic'
            ? ({ type: 'italic', children } as MarkupNode)
            : kind === 'strike'
              ? ({ type: 'strike', children } as MarkupNode)
              : ({ type: 'spoiler', children } as MarkupNode);
      nodes.push(wrap);
    }
  }

  return nodes;
}

function nodesToHtml(nodes: MarkupNode[]): string {
  const parts: string[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        parts.push(escapeHtml(n.value));
        break;
      case 'linebreak':
        parts.push('<br />');
        break;
      case 'code':
        parts.push('<code>', escapeHtml(n.value), '</code>');
        break;
      case 'bold':
        parts.push('<strong>', nodesToHtml(n.children), '</strong>');
        break;
      case 'italic':
        parts.push('<em>', nodesToHtml(n.children), '</em>');
        break;
      case 'strike':
        parts.push('<del>', nodesToHtml(n.children), '</del>');
        break;
      case 'spoiler':
        parts.push(
          '<span data-mx-spoiler="">',
          nodesToHtml(n.children),
          '</span>',
        );
        break;
      case 'blockquote':
        parts.push('<blockquote>', nodesToHtml(n.children), '</blockquote>');
        break;
      default:
        break;
    }
  }
  return parts.join('');
}

/**
 * If markup is present, returns Matrix `format` + `formatted_body` alongside `body`.
 */
export function matrixTextEventContentWithOptionalFormatting(body: string):
  | { body: string }
  | {
      body: string;
      format: string;
      formatted_body: string;
    } {
  const trimmed = body.trim();
  if (!trimmed || !chatMarkupLooksFormatted(body)) {
    return { body };
  }
  const tree = parseChatMarkup(body);
  const html = nodesToHtml(tree).trim();
  if (!html) {
    return { body };
  }
  return {
    body,
    format: MATRIX_CUSTOM_HTML_FORMAT,
    formatted_body: html,
  };
}

/**
 * Rich reply with optional markup in the new text only; quoted block stays plain HTML.
 */
export function buildRichReplyMatrixContent(
  targetSenderMxid: string,
  targetBody: string,
  replyText: string,
): { body: string; format: string; formatted_body: string } {
  const plain = buildRichReplyPlainBody(
    targetSenderMxid,
    targetBody,
    replyText,
  );
  const { quoted, reply } = splitRichReplyPlainBody(plain);
  const quotedHtml = escapeHtml(quoted).replace(/\n/g, '<br />');
  const replyFormatted = matrixTextEventContentWithOptionalFormatting(reply);
  const replyHtml =
    'formatted_body' in replyFormatted
      ? replyFormatted.formatted_body
      : escapeHtml(reply).replace(/\n/g, '<br />');
  return {
    body: plain,
    format: MATRIX_CUSTOM_HTML_FORMAT,
    formatted_body: `${quotedHtml}<br /><br />${replyHtml}`,
  };
}
