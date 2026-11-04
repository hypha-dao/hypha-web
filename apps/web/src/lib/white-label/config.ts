import type {
  WhiteLabelClientRecord,
  WhiteLabelConfig,
  WhiteLabelSpaceRecord,
} from './types';

/**
 * Env-backed config for the iframe delivery. One variable holding a JSON
 * array of client records, the same shape the future registry will return:
 *
 *   WHITE_LABEL_EMBED_CONFIG=[{"id":"example-client","spaces":[{"slug":"example-space","framingOrigins":["https://partner.example"]}]}]
 *
 * Unset, empty or unparsable means the feature is off.
 */
export const WHITE_LABEL_CONFIG_ENV = 'WHITE_LABEL_EMBED_CONFIG';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLIENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

/**
 * Normalises one framing origin, or returns null. Accepts `https://host[:port]`
 * and `http://` only for localhost. No wildcards, paths, queries, credentials
 * or characters that could alter the CSP value.
 */
export function normaliseFramingOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw === '' || /[\s;,'"*\\]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.pathname !== '/' || url.search || url.hash) return null;
  if (raw.replace(/\/$/, '') !== url.origin) return null;
  if (url.protocol === 'https:') return url.origin;
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) {
    return url.origin;
  }
  return null;
}

function parseSpace(input: unknown): WhiteLabelSpaceRecord | null {
  if (typeof input !== 'object' || input === null) return null;
  const { slug, framingOrigins } = input as Record<string, unknown>;
  if (!isValidSlug(slug) || !Array.isArray(framingOrigins)) return null;
  const origins = [
    ...new Set(
      framingOrigins
        .map(normaliseFramingOrigin)
        .filter((origin): origin is string => origin !== null),
    ),
  ];
  // Fail closed: a Space that nobody may frame is not served.
  if (origins.length === 0) return null;
  return { slug, framingOrigins: origins };
}

function parseClient(input: unknown): WhiteLabelClientRecord | null {
  if (typeof input !== 'object' || input === null) return null;
  const { id, spaces } = input as Record<string, unknown>;
  if (typeof id !== 'string' || !CLIENT_ID_PATTERN.test(id)) return null;
  if (!Array.isArray(spaces)) return null;
  const parsed = spaces
    .map(parseSpace)
    .filter((space): space is WhiteLabelSpaceRecord => space !== null);
  if (parsed.length === 0) return null;
  return { id, spaces: parsed };
}

export const EMPTY_WHITE_LABEL_CONFIG: WhiteLabelConfig = { clients: [] };

/** Pure parser (testable). Anything invalid is dropped; nothing throws. */
export function parseWhiteLabelConfig(
  raw: string | undefined | null,
): WhiteLabelConfig {
  if (!raw || raw.trim() === '') return EMPTY_WHITE_LABEL_CONFIG;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return EMPTY_WHITE_LABEL_CONFIG;
  }
  if (!Array.isArray(json)) return EMPTY_WHITE_LABEL_CONFIG;
  const clients = json
    .map(parseClient)
    .filter((client): client is WhiteLabelClientRecord => client !== null);
  return { clients };
}

/** Reads the env variable on every call (cheap; keeps tests and edge simple). */
export function getWhiteLabelConfig(): WhiteLabelConfig {
  return parseWhiteLabelConfig(process.env[WHITE_LABEL_CONFIG_ENV]);
}
