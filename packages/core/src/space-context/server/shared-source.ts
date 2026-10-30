import { isIP } from 'node:net';

import {
  ASSET_MAX_TEXT_CHARS,
  bytesToBase64,
  extractPdfText,
  isImageMime,
  isOfficeDocMime,
  isPdfMime,
  isPlaintextMime,
  normalizeMime,
  truncateText,
  utf8Decode,
} from '../../common/server/asset-content';

const MAX_URL_LENGTH = 2048;

export type SpaceContextSharedSourceErrorCode =
  | 'invalid_url'
  | 'blocked_url'
  | 'not_shared'
  | 'access_denied'
  | 'fetch_failed'
  | 'too_large'
  | 'unsupported_type'
  | 'decode_failed';

export type SpaceContextSharedSourceFailure = {
  ok: false;
  error: string;
  code: SpaceContextSharedSourceErrorCode;
};

export type SpaceContextSharedSourceContent = {
  filename: string;
  mime: string;
  mode: 'text' | 'binary';
  title?: string;
  text?: string;
  text_truncated?: boolean;
  data_base64?: string;
  byte_length: number;
};

const BLOCKED_IPV4_CIDRS: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function ipv4ToInt(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return true;
  return BLOCKED_IPV4_CIDRS.some(([base, bits]) => {
    const baseValue = ipv4ToInt(base) as number;
    const size = 2 ** (32 - bits);
    return Math.floor(value / size) === Math.floor(baseValue / size);
  });
}

function expandIpv6(address: string): number[] | null {
  let addr = address.toLowerCase().split('%')[0] ?? '';
  const lastColon = addr.lastIndexOf(':');
  if (addr.includes('.')) {
    const v4 = ipv4ToInt(addr.slice(lastColon + 1));
    if (v4 === null) return null;
    addr = `${addr.slice(0, lastColon + 1)}${Math.floor(v4 / 65536).toString(
      16,
    )}:${(v4 % 65536).toString(16)}`;
  }
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) =>
    part === '' ? [] : part.split(':').map((g) => parseInt(g, 16));
  const head = parse(halves[0] ?? '');
  const tail = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...new Array(missing).fill(0), ...tail];
  if (groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) {
    return null;
  }
  return groups;
}

/**
 * True when an address must never be fetched server-side: private, loopback,
 * link-local, multicast, documentation, tunnelling and other non-public ranges.
 * Unparseable input fails closed.
 */
export function isBlockedIpAddress(address: string): boolean {
  const version = isIP(address.split('%')[0] ?? '');
  if (version === 4) return isBlockedIpv4(address);
  if (version !== 6) return true;
  const g = expandIpv6(address);
  if (!g) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const leadingZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (leadingZero && g5 === 0xffff) {
    return isBlockedIpv4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`);
  }
  if (leadingZero && g5 === 0) return true;
  if (g0 === 0x64 && g1 === 0xff9b) return true;
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0xdb8)) return true;
  if (g0 === 0x2002) return true;
  return (g0 & 0xe000) !== 0x2000;
}

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.lan',
];

export function parseSharedSourceUrl(
  raw: string,
): { ok: true; url: URL } | SpaceContextSharedSourceFailure {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: 'Invalid URL', code: 'invalid_url' };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid URL', code: 'invalid_url' };
  }
  if (url.protocol !== 'https:') {
    return {
      ok: false,
      error: 'Only https links can be read',
      code: 'invalid_url',
    };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      error: 'Links with credentials cannot be read',
      code: 'invalid_url',
    };
  }
  if (url.port && url.port !== '443') {
    return {
      ok: false,
      error: 'Only the default https port can be read',
      code: 'blocked_url',
    };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const bareHost = host.replace(/^\[|\]$/g, '');
  if (isIP(bareHost)) {
    if (isBlockedIpAddress(bareHost)) {
      return {
        ok: false,
        error: 'This address is not reachable from Hypha',
        code: 'blocked_url',
      };
    }
    return { ok: true, url };
  }
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return {
      ok: false,
      error: 'This address is not reachable from Hypha',
      code: 'blocked_url',
    };
  }
  return { ok: true, url };
}

function comparableUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function trimUrlCandidate(candidate: string): string {
  let url = candidate;
  for (;;) {
    const last = url.at(-1);
    if (!last) return url;
    if ('.,;:!?*_~\'"'.includes(last)) {
      url = url.slice(0, -1);
      continue;
    }
    if (last === ')' || last === ']') {
      const open = last === ')' ? '(' : '[';
      const opens = url.split(open).length - 1;
      const closes = url.split(last).length - 1;
      if (closes > opens) {
        url = url.slice(0, -1);
        continue;
      }
    }
    return url;
  }
}

/** https links found in member messages, normalized and de-duplicated. */
export function extractSharedSourceUrls(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/https:\/\/[^\s<>"'`]+/gi)) {
      const href = comparableUrl(trimUrlCandidate(match[0]));
      if (href) found.add(href);
    }
  }
  return [...found];
}

export function isSharedSourceUrl(url: string, sharedUrls: string[]): boolean {
  const want = comparableUrl(url);
  if (!want) return false;
  return sharedUrls.some((shared) => comparableUrl(shared) === want);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi,
    (entity, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
          return entity;
        }
        try {
          return String.fromCodePoint(code);
        } catch {
          return entity;
        }
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    },
  );
}

const DROPPED_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'head',
  'title',
  'nav',
  'footer',
];

/** Linear scan; regex backtracking on hostile HTML must not stall the chat route. */
function dropElements(html: string): string {
  const lower = html.toLowerCase();
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = lower.indexOf('<', i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      out += ' ';
      continue;
    }
    const tag = DROPPED_ELEMENTS.find((name) => {
      if (!lower.startsWith(`<${name}`, lt)) return false;
      const next = lower[lt + name.length + 1] ?? '';
      return next === '>' || next === '/' || /\s/.test(next);
    });
    if (!tag) {
      out += '<';
      i = lt + 1;
      continue;
    }
    const close = lower.indexOf(`</${tag}`, lt + tag.length + 1);
    if (close === -1) {
      i = html.length;
    } else {
      const gt = lower.indexOf('>', close);
      i = gt === -1 ? html.length : gt + 1;
    }
    out += ' ';
  }
  return out;
}

export function htmlToText(html: string): {
  title: string | null;
  text: string;
} {
  const titleMatch = /<title[^<>]*>([^<]*)</i.exec(html);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1] ?? '')
        .replace(/\s+/g, ' ')
        .trim() || null
    : null;
  const text = decodeHtmlEntities(
    dropElements(html)
      .replace(/<br[^<>]*>/gi, '\n')
      .replace(
        /<h([1-6])(?:\s[^<>]*)?>/gi,
        (_m, level: string) => `\n\n${'#'.repeat(Number(level))} `,
      )
      .replace(/<\/h[1-6]\s*>/gi, '\n\n')
      .replace(/<li(?:\s[^<>]*)?>/gi, '\n- ')
      .replace(
        /<\/?(?:p|div|section|article|header|main|aside|ul|ol|tr|table|blockquote|pre|figure|figcaption|dl|dt|dd|hr)(?:\s[^<>]*)?\/?>/gi,
        '\n',
      )
      .replace(/<\/t[dh]\s*>/gi, ' ')
      .replace(/<[^<>]*>/g, ''),
  )
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .filter((line) => line !== '-')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, text };
}

function charsetFromContentType(contentType: string | null): string | null {
  const match = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? '');
  return match?.[1]?.trim() || null;
}

function decodeTextBytes(bytes: Uint8Array, charset: string | null): string {
  const strict = utf8Decode(bytes);
  if (strict !== null && (!charset || /^utf-?8$/i.test(charset))) {
    return strict;
  }
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  return utf8Decode(bytes.subarray(0, Math.min(bytes.length, 64_000))) !== null;
}

export function filenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:utf-8|UTF-8)''([^;]+)/.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain filename parameter
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

/**
 * Turn fetched bytes into model-ready content: HTML and text become text, PDFs
 * become extracted text, images and Office files stay binary for multimodal
 * models — the same decoding the org-memory asset reader uses.
 */
export async function decodeSharedSourceBytes({
  bytes,
  contentType,
  filename,
}: {
  bytes: Uint8Array;
  contentType: string | null;
  filename: string;
}): Promise<
  | ({ ok: true } & SpaceContextSharedSourceContent)
  | SpaceContextSharedSourceFailure
> {
  let mime = normalizeMime(contentType, filename).toLowerCase();
  if (mime === 'application/octet-stream') {
    if (looksLikePdf(bytes)) mime = 'application/pdf';
    else if (looksLikeText(bytes)) mime = 'text/plain';
  }
  const byteLength = bytes.byteLength;
  const charset = charsetFromContentType(contentType);

  if (mime === 'text/html' || mime === 'application/xhtml+xml') {
    const { title, text: pageText } = htmlToText(
      decodeTextBytes(bytes, charset),
    );
    const { text, truncated } = truncateText(pageText, ASSET_MAX_TEXT_CHARS);
    return {
      ok: true,
      filename: title || filename,
      mime,
      mode: 'text',
      ...(title ? { title } : {}),
      text,
      text_truncated: truncated,
      byte_length: byteLength,
    };
  }
  if (isPlaintextMime(mime)) {
    const { text, truncated } = truncateText(
      decodeTextBytes(bytes, charset),
      ASSET_MAX_TEXT_CHARS,
    );
    return {
      ok: true,
      filename,
      mime,
      mode: 'text',
      text,
      text_truncated: truncated,
      byte_length: byteLength,
    };
  }
  if (isPdfMime(mime)) {
    const extracted = await extractPdfText(bytes);
    if (extracted === null) {
      return {
        ok: false,
        error: 'Could not extract text from PDF',
        code: 'decode_failed',
      };
    }
    if (extracted === '') {
      // Scanned PDFs have no text layer; hand the file to a multimodal model.
      return {
        ok: true,
        filename,
        mime,
        mode: 'binary',
        data_base64: bytesToBase64(bytes),
        byte_length: byteLength,
      };
    }
    const { text, truncated } = truncateText(extracted, ASSET_MAX_TEXT_CHARS);
    return {
      ok: true,
      filename,
      mime,
      mode: 'text',
      text,
      text_truncated: truncated,
      byte_length: byteLength,
    };
  }
  if (isImageMime(mime) || isOfficeDocMime(mime)) {
    return {
      ok: true,
      filename,
      mime,
      mode: 'binary',
      data_base64: bytesToBase64(bytes),
      byte_length: byteLength,
    };
  }
  return {
    ok: false,
    error: `Unsupported file type: ${mime}`,
    code: 'unsupported_type',
  };
}
