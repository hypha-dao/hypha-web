import type {
  WhiteLabelAuthConfig,
  WhiteLabelClientRecord,
  WhiteLabelConfig,
  WhiteLabelHostClientRecord,
  WhiteLabelHostRecord,
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
 * Validates one framing origin and returns it in canonical form, or null.
 * The host is case-insensitive; other spellings must already be canonical. Accepts `https://host[:port]`
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
  // Canonical spelling only (the parser would also accept odd forms such as
  // `https:host` or an explicit default port); case is ignored.
  if (raw.replace(/\/$/, '').toLowerCase() !== url.origin) return null;
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

export const EMPTY_WHITE_LABEL_CONFIG: WhiteLabelConfig = {
  clients: [],
  hostClients: [],
  mainHosts: [],
};

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
  return { ...EMPTY_WHITE_LABEL_CONFIG, clients };
}

// ---------------------------------------------------------------------------
// Host delivery (A1)
// ---------------------------------------------------------------------------

/**
 * Env-backed config for the host delivery: a JSON array of client records, each
 * with the hosts it has mapped and the one Space each host serves at its root.
 * `authConfig` is optional (login is a later step) and unused until then:
 *
 *   WHITE_LABEL_HOST_CONFIG=[{"id":"example-client","hosts":[{"host":"space.partner.example","space":"example-space","authConfig":{"privyClientId":"client-...","cookieDomain":"space.partner.example"}}]}]
 *
 * Unset, empty or unparsable means no host is mapped. A host listed twice (in
 * one client or in two) is dropped everywhere: one owner per host.
 */
export const WHITE_LABEL_HOST_CONFIG_ENV = 'WHITE_LABEL_HOST_CONFIG';

const DNS_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DNS_HOST_PATTERN = new RegExp(`^${DNS_LABEL}(?:\\.${DNS_LABEL})+$`);
const PRIVY_CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** `localhost`, `*.localhost` and `127.0.0.1`: the only hosts that may carry a port. */
export function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1'
  );
}

/**
 * Canonical form of a host (a `Host` header value or a config entry), or null.
 * Lower case, no trailing dot, ASCII (IDNs in punycode), at least two labels,
 * no IP literal (except `127.0.0.1`), no wildcard, credentials or path. A port
 * is kept for local hosts only.
 */
export function normaliseHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let raw = value.trim().toLowerCase();
  if (raw === '' || raw.length > 260) return null;
  if (raw.endsWith('.')) raw = raw.slice(0, -1);
  let hostname = raw;
  let port = '';
  const colon = raw.lastIndexOf(':');
  if (colon !== -1) {
    hostname = raw.slice(0, colon);
    port = raw.slice(colon + 1);
    if (!/^[0-9]{1,5}$/.test(port)) return null;
  }
  if (hostname === '' || hostname.length > 253) return null;
  if (isLocalHost(hostname)) {
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // `<label>.localhost`: labels must still be valid.
      if (!DNS_HOST_PATTERN.test(hostname)) return null;
    }
    return port ? `${hostname}:${port}` : hostname;
  }
  if (port !== '') return null;
  if (!DNS_HOST_PATTERN.test(hostname)) return null;
  // The last label must not be numeric (rules out IPv4 literals).
  const tld = hostname.slice(hostname.lastIndexOf('.') + 1);
  if (/^[0-9]+$/.test(tld)) return null;
  return hostname;
}

/** Hostname without port, for cookie-domain comparisons. */
function hostnameOf(host: string): string {
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

/**
 * Validates login settings: a plain client id and a cookie domain that is the
 * host itself or one of its parent domains (a Privy cookie can not be set for
 * a name the page is not under). Returns null for anything else.
 */
export function parseAuthConfig(
  input: unknown,
  host: string,
): WhiteLabelAuthConfig | null {
  if (typeof input !== 'object' || input === null) return null;
  const { privyClientId, cookieDomain } = input as Record<string, unknown>;
  if (
    typeof privyClientId !== 'string' ||
    !PRIVY_CLIENT_ID_PATTERN.test(privyClientId)
  ) {
    return null;
  }
  const domain = normaliseHost(cookieDomain);
  if (domain === null || domain.includes(':')) return null;
  const hostname = hostnameOf(host);
  if (hostname !== domain && !hostname.endsWith(`.${domain}`)) return null;
  return { privyClientId, cookieDomain: domain };
}

function parseHostRecord(input: unknown): WhiteLabelHostRecord | null {
  if (typeof input !== 'object' || input === null) return null;
  const { host, space, authConfig } = input as Record<string, unknown>;
  const normalised = normaliseHost(host);
  if (normalised === null || !isValidSlug(space)) return null;
  if (authConfig === undefined) return { host: normalised, spaceSlug: space };
  // Fail closed: a malformed auth config drops the host instead of being ignored.
  const auth = parseAuthConfig(authConfig, normalised);
  if (auth === null) return null;
  return { host: normalised, spaceSlug: space, authConfig: auth };
}

function parseHostClient(input: unknown): WhiteLabelHostClientRecord | null {
  if (typeof input !== 'object' || input === null) return null;
  const { id, hosts } = input as Record<string, unknown>;
  if (typeof id !== 'string' || !CLIENT_ID_PATTERN.test(id)) return null;
  if (!Array.isArray(hosts)) return null;
  const parsed = hosts
    .map(parseHostRecord)
    .filter((record): record is WhiteLabelHostRecord => record !== null);
  if (parsed.length === 0) return null;
  return { id, hosts: parsed };
}

/** Pure parser (testable). Invalid entries and ambiguous hosts are dropped. */
export function parseWhiteLabelHostConfig(
  raw: string | undefined | null,
): WhiteLabelHostClientRecord[] {
  if (!raw || raw.trim() === '') return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(json)) return [];
  const clients = json
    .map(parseHostClient)
    .filter((c): c is WhiteLabelHostClientRecord => c !== null);

  // One owner per host: a host claimed twice is claimed by nobody.
  const counts = new Map<string, number>();
  for (const client of clients) {
    for (const { host } of client.hosts) {
      counts.set(host, (counts.get(host) ?? 0) + 1);
    }
  }
  return clients
    .map((client) => ({
      ...client,
      hosts: client.hosts.filter((h) => counts.get(h.host) === 1),
    }))
    .filter((client) => client.hosts.length > 0);
}

function hostOfUrlOrHost(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return normaliseHost(
      new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host,
    );
  } catch {
    return null;
  }
}

/**
 * Hosts the main app is served on, derived from the deployment's own env (no
 * separate list to maintain): the app URL, this deployment's Vercel URLs, and
 * local hosts outside production. With hosts mapped, a host that is neither
 * mapped nor one of these is not served.
 */
// Not `getAppBaseUrl()` (`@hypha-platform/core/server`): this runs in middleware
// on the edge, and the question is "is this host us?", which must also accept
// the deployment's own `VERCEL_URL` on production (internal self-calls such as
// the cron routes use it), where that helper deliberately skips it.
function derivedMainHosts(): string[] {
  const candidates = [
    ...(process.env.NODE_ENV === 'production'
      ? []
      : ['localhost', '127.0.0.1']),
    // Literal reads: `NEXT_PUBLIC_*` is inlined at build time.
    hostOfUrlOrHost(process.env.NEXT_PUBLIC_APP_URL),
    hostOfUrlOrHost(process.env.VERCEL_URL),
    hostOfUrlOrHost(process.env.VERCEL_BRANCH_URL),
    hostOfUrlOrHost(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ];
  return candidates.filter((host): host is string => host !== null);
}

/** Reads the env variables on every call (cheap; keeps tests and edge simple). */
export function getWhiteLabelConfig(): WhiteLabelConfig {
  const base = parseWhiteLabelConfig(process.env[WHITE_LABEL_CONFIG_ENV]);
  const hostClients = parseWhiteLabelHostConfig(
    process.env[WHITE_LABEL_HOST_CONFIG_ENV],
  );
  if (hostClients.length === 0) return base;
  const mainHosts = [...new Set(derivedMainHosts())];
  return { ...base, hostClients, mainHosts };
}
