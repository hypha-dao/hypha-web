/**
 * White-label types. Pure: no Next or React imports, so the resolver can be
 * unit-tested and reused by middleware, layouts and (later) a registry loader.
 */

/** One Space a client may show in an iframe, with the origins allowed to frame it. */
export type WhiteLabelSpaceRecord = {
  /** Space slug as in the main app. */
  slug: string;
  /** Normalised origins (`https://host[:port]`) allowed to frame this Space. */
  framingOrigins: string[];
};

/** A client record of the iframe delivery. Same shape the future registry will return. */
export type WhiteLabelClientRecord = {
  id: string;
  spaces: WhiteLabelSpaceRecord[];
};

/**
 * Login settings of a mapped host. Public values only (they reach the browser).
 * Parsed and carried to the layout in PR 1; used by the Privy provider in PR 2.
 */
export type WhiteLabelAuthConfig = {
  /** Privy app-client id of this host (never a `NEXT_PUBLIC_*` build value). */
  privyClientId: string;
  /** Verified cookie domain of that client: this host or a parent of it. */
  cookieDomain: string;
};

/** One host a client has mapped, serving exactly one Space at its root. */
export type WhiteLabelHostRecord = {
  /** Normalised host (`partner.example`; `localhost` forms may carry a port). */
  host: string;
  spaceSlug: string;
  authConfig?: WhiteLabelAuthConfig;
};

/** A client record of the host delivery (A1). */
export type WhiteLabelHostClientRecord = {
  id: string;
  hosts: WhiteLabelHostRecord[];
};

export type WhiteLabelConfig = {
  /** Iframe delivery (`/embed`). */
  clients: WhiteLabelClientRecord[];
  /** Host delivery (A1). Empty means no host is mapped. */
  hostClients: WhiteLabelHostClientRecord[];
  /**
   * Hosts the main app is served on. With hosts mapped, any other host is not
   * served (a name attached to the project but not mapped must not show the app).
   */
  mainHosts: string[];
};

export type ResolveOptions = {
  /** Locale codes accepted as the optional segment after the Space slug. */
  locales: readonly string[];
  defaultLocale: string;
  /**
   * Raw `Accept-Language` header. Used only when the path carries no locale
   * (a cookie is not an option in the iframe: cross-site frames do not send
   * `SameSite=Lax`).
   */
  acceptLanguage?: string | null;
  /** Value of the locale cookie. Read in host mode only (first party there). */
  localeCookie?: string | null;
  /** HTTP method; the `/api` allowlist of a mapped host is GET and HEAD only. */
  method?: string;
};

/** Iframe delivery (`/embed`). */
export type ResolvedSpace = {
  mode: 'embed';
  /** Client ids that approved this Space (config order). */
  clientIds: string[];
  spaceSlug: string;
  locale: string;
  /** Union of the approving clients' framing origins for this Space (embed only). */
  framingOrigins: string[];
};

/** Host delivery: the one client that owns the host, and its Space. */
export type ResolvedHost = Omit<ResolvedSpace, 'mode'> & {
  mode: 'host';
  clientId: string;
  spaces: string[];
  authConfig?: WhiteLabelAuthConfig;
  /** True when the locale came from the path: middleware remembers it in a cookie. */
  localeFromPath: boolean;
};

export type NotFoundReason =
  | 'internal-prefix'
  | 'unapproved-space'
  | 'malformed-path'
  | 'api-not-served'
  | 'unknown-host'
  | 'api-not-allowed'
  | 'embed-not-served';

export type ResolveDecision =
  /** Not white label: handled by the existing middleware chain. */
  | { kind: 'pass' }
  /** Serve the internal tree. `pathname` is the internal `/wl/...` path. */
  | ({ kind: 'rewrite'; pathname: string } & (ResolvedSpace | ResolvedHost))
  /**
   * An `/api` read a mapped host may call. The route runs; `spaceSlug` is the
   * host's Space, passed on so handlers can scope what they return to it.
   */
  | { kind: 'api-allow'; spaceSlug: string }
  /** Not served: unapproved slug, internal prefix reached from outside, odd path. */
  | { kind: 'not-found'; reason: NotFoundReason };
