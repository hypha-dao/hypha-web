/**
 * Discord-like plaintext markup for chat: **bold**, *italic*, __underline__,
 * ~~strike~~, `code`, ||spoiler||, > blockquotes, # headings, and - / 1. lists.
 * Used for composer → Matrix HTML and timeline rendering.
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
  | { type: 'underline'; children: MarkupNode[] }
  | { type: 'strike'; children: MarkupNode[] }
  | { type: 'code'; value: string }
  | { type: 'spoiler'; children: MarkupNode[] }
  | { type: 'link'; href: string; children: MarkupNode[] }
  | { type: 'linebreak' }
  | { type: 'blockquote'; children: MarkupNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; children: MarkupNode[] }
  | { type: 'ul'; items: MarkupNode[][] }
  | { type: 'ol'; items: MarkupNode[][] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** http(s), www, or same-origin path — never javascript:/data:. */
export function isSafeChatLinkHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeChatHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.toLowerCase().startsWith('www.')) {
    const withProtocol = `https://${href}`;
    return isSafeChatLinkHref(withProtocol) ? withProtocol : null;
  }
  return isSafeChatLinkHref(href) ? href : null;
}

function readMarkdownLink(
  s: string,
  i: number,
): { label: string; href: string; end: number } | null {
  if (s[i] !== '[') return null;
  if (i > 0 && s[i - 1] === '!') return null;
  const labelStart = i + 1;
  let labelEnd = labelStart;
  while (labelEnd < s.length) {
    const ch = s[labelEnd];
    if (ch === '\n' || ch === ']') break;
    labelEnd += 1;
  }
  if (labelEnd >= s.length || s[labelEnd] !== ']') return null;
  if (labelEnd === labelStart) return null;
  if (s[labelEnd + 1] !== '(') return null;
  const urlStart = labelEnd + 2;
  let urlEnd = urlStart;
  while (urlEnd < s.length) {
    const ch = s[urlEnd];
    if (ch === '\n' || ch === ')' || ch === ' ' || ch === '\t') break;
    urlEnd += 1;
  }
  if (urlEnd >= s.length || s[urlEnd] !== ')' || urlEnd === urlStart) {
    return null;
  }
  const href = normalizeChatHref(s.slice(urlStart, urlEnd));
  if (!href) return null;
  return {
    label: s.slice(labelStart, labelEnd),
    href,
    end: urlEnd + 1,
  };
}

function hasMarkdownLink(plain: string): boolean {
  for (let i = 0; i < plain.length; i += 1) {
    if (plain[i] === '[' && readMarkdownLink(plain, i)) return true;
  }
  return false;
}

function isUrlWordBoundary(s: string, i: number): boolean {
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

function trimAutolinkRaw(raw: string): string {
  let s = raw;
  while (
    s.length > 0 &&
    (s[s.length - 1] === '.' ||
      s[s.length - 1] === ',' ||
      s[s.length - 1] === ';' ||
      s[s.length - 1] === ':' ||
      s[s.length - 1] === '!' ||
      s[s.length - 1] === '?')
  ) {
    s = s.slice(0, -1);
  }
  while (s.length > 0 && s[s.length - 1] === ')') {
    const prefix = s.slice(0, -1);
    let opens = 0;
    let closes = 0;
    for (let i = 0; i < prefix.length; i += 1) {
      if (prefix[i] === '(') opens += 1;
      else if (prefix[i] === ')') closes += 1;
    }
    if (opens > closes) break;
    s = prefix;
  }
  return s;
}

function readAutolinkUrl(
  s: string,
  i: number,
): { raw: string; href: string; end: number } | null {
  if (!isUrlWordBoundary(s, i)) return null;
  let prefixLen = 0;
  if (s.startsWith('https://', i)) prefixLen = 8;
  else if (s.startsWith('http://', i)) prefixLen = 7;
  else if (s.startsWith('www.', i)) prefixLen = 4;
  else return null;
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
  if (end <= i + prefixLen) return null;
  const raw = trimAutolinkRaw(s.slice(i, end));
  if (raw.length <= prefixLen) return null;
  const href = normalizeChatHref(raw);
  if (!href) return null;
  return { raw, href, end: i + raw.length };
}

function findNextMarkdownLink(s: string, from: number): number {
  for (let i = from; i < s.length; i += 1) {
    if (s[i] === '[' && readMarkdownLink(s, i)) return i;
  }
  return -1;
}

function findNextAutolink(s: string, from: number): number {
  let best = -1;
  const consider = (idx: number) => {
    if (idx >= 0 && readAutolinkUrl(s, idx) && (best < 0 || idx < best)) {
      best = idx;
    }
  };
  consider(s.indexOf('https://', from));
  consider(s.indexOf('http://', from));
  consider(s.indexOf('www.', from));
  return best;
}

/**
 * True if the string uses chat markup delimiters (may still parse to plain text).
 */
export function chatMarkupLooksFormatted(plain: string): boolean {
  if (!plain) return false;
  return (
    hasMarkdownLink(plain) ||
    /\*\*/.test(plain) ||
    /~~/.test(plain) ||
    /\|\|/.test(plain) ||
    /`/.test(plain) ||
    /__/.test(plain) ||
    /(^|\n)>\s?/m.test(plain) ||
    /(^|\n)#{1,4}\s+\S/m.test(plain) ||
    /(^|\n)(\s{0,3})([-*+]|\d+\.)\s+\S/m.test(plain) ||
    /\*[^*\n]+\*/.test(plain)
  );
}

function parseHeadingLine(
  line: string,
): { level: 1 | 2 | 3 | 4; text: string } | null {
  const match = line.match(/^(#{1,4})\s+(.*)$/);
  if (!match) return null;
  const level = match[1]!.length as 1 | 2 | 3 | 4;
  return { level, text: match[2] ?? '' };
}

function parseUnorderedListItem(line: string): string | null {
  const match = line.match(/^(\s{0,3})[-*+]\s+(.*)$/);
  return match ? match[2] ?? '' : null;
}

function parseOrderedListItem(line: string): string | null {
  const match = line.match(/^(\s{0,3})\d+\.\s+(.*)$/);
  return match ? match[2] ?? '' : null;
}

/**
 * Parse block structure (lines, blockquotes, headings, lists) then inline marks.
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

    const heading = parseHeadingLine(line);
    if (heading) {
      out.push({
        type: 'heading',
        level: heading.level,
        children: parseInlineMarkup(heading.text),
      });
      i += 1;
      continue;
    }

    const ulItems: MarkupNode[][] = [];
    while (i < lines.length) {
      const item = parseUnorderedListItem(lines[i]!);
      if (item === null) break;
      ulItems.push(parseInlineMarkup(item));
      i += 1;
    }
    if (ulItems.length > 0) {
      out.push({ type: 'ul', items: ulItems });
      continue;
    }

    const olItems: MarkupNode[][] = [];
    while (i < lines.length) {
      const item = parseOrderedListItem(lines[i]!);
      if (item === null) break;
      olItems.push(parseInlineMarkup(item));
      i += 1;
    }
    if (olItems.length > 0) {
      out.push({ type: 'ol', items: olItems });
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

type DelimKind =
  | 'code'
  | 'spoiler'
  | 'bold'
  | 'underline'
  | 'strike'
  | 'italic';

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
    if (s.slice(idx, idx + 2) === '__') {
      consider('underline', idx, 2);
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
    case 'underline': {
      const i = s.indexOf('__', innerStart);
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
    const nextDelim = findNextDelimiter(s, pos);
    const nextMd = findNextMarkdownLink(s, pos);
    const nextUrl = findNextAutolink(s, pos);

    let nextStart = s.length;
    let kind: 'end' | 'delim' | 'md' | 'url' = 'end';
    if (nextDelim && nextDelim.start < nextStart) {
      nextStart = nextDelim.start;
      kind = 'delim';
    }
    if (nextMd >= 0 && nextMd < nextStart) {
      nextStart = nextMd;
      kind = 'md';
    }
    if (nextUrl >= 0 && nextUrl < nextStart) {
      nextStart = nextUrl;
      kind = 'url';
    }

    if (nextStart > pos) {
      nodes.push({ type: 'text', value: s.slice(pos, nextStart) });
    }
    if (kind === 'end') break;

    if (kind === 'md') {
      const md = readMarkdownLink(s, nextStart);
      if (!md) {
        nodes.push({ type: 'text', value: s[nextStart]! });
        pos = nextStart + 1;
        continue;
      }
      nodes.push({
        type: 'link',
        href: md.href,
        children: parseInlineMarkup(md.label),
      });
      pos = md.end;
      continue;
    }

    if (kind === 'url') {
      const auto = readAutolinkUrl(s, nextStart);
      if (!auto) {
        nodes.push({ type: 'text', value: s[nextStart]! });
        pos = nextStart + 1;
        continue;
      }
      nodes.push({
        type: 'link',
        href: auto.href,
        children: [{ type: 'text', value: auto.raw }],
      });
      pos = auto.end;
      continue;
    }

    const next = nextDelim!;
    const { kind: delimKind, endOpen } = next;
    const innerStart = endOpen;
    const close = findClosingDelimiter(s, innerStart, delimKind);
    if (!close) {
      nodes.push({ type: 'text', value: s.slice(next.start, innerStart) });
      pos = innerStart;
      continue;
    }
    const { innerEnd, len } = close;
    const inner = s.slice(innerStart, innerEnd);
    pos = innerEnd + len;

    if (delimKind === 'code') {
      nodes.push({ type: 'code', value: inner });
    } else {
      const children = parseInlineMarkup(inner);
      const wrap =
        delimKind === 'bold'
          ? ({ type: 'bold', children } as MarkupNode)
          : delimKind === 'italic'
          ? ({ type: 'italic', children } as MarkupNode)
          : delimKind === 'underline'
          ? ({ type: 'underline', children } as MarkupNode)
          : delimKind === 'strike'
          ? ({ type: 'strike', children } as MarkupNode)
          : ({ type: 'spoiler', children } as MarkupNode);
      nodes.push(wrap);
    }
  }

  return nodes;
}

export function nodesToHtml(nodes: MarkupNode[]): string {
  const parts: string[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        parts.push(escapeHtml(n.value));
        break;
      case 'link':
        parts.push(
          '<a href="',
          escapeHtml(n.href),
          '" target="_blank" rel="noopener noreferrer nofollow">',
          nodesToHtml(n.children),
          '</a>',
        );
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
      case 'underline':
        parts.push('<u>', nodesToHtml(n.children), '</u>');
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
      case 'heading': {
        const tag = `h${n.level}`;
        parts.push(`<${tag}>`, nodesToHtml(n.children), `</${tag}>`);
        break;
      }
      case 'ul':
        parts.push(
          '<ul>',
          ...n.items.map((item) => `<li>${nodesToHtml(item)}</li>`),
          '</ul>',
        );
        break;
      case 'ol':
        parts.push(
          '<ol>',
          ...n.items.map((item) => `<li>${nodesToHtml(item)}</li>`),
          '</ol>',
        );
        break;
      default:
        break;
    }
  }
  return parts.join('');
}

/** Parse chat markup to Matrix HTML (always; caller decides when to attach). */
export function chatMarkupToHtml(plain: string): string {
  return nodesToHtml(parseChatMarkup(plain)).trim();
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
  const html = chatMarkupToHtml(body);
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
