/**
 * White-label types. Pure: no Next or React imports, so the resolver can be
 * unit-tested and reused by middleware, layouts and (later) a registry loader.
 */

/** One Space a client may show, with the origins allowed to frame it. */
export type WhiteLabelSpaceRecord = {
  /** Space slug as in the main app. */
  slug: string;
  /** Normalised origins (`https://host[:port]`) allowed to frame this Space. */
  framingOrigins: string[];
};

/** A client record. Same shape the future registry will return. */
export type WhiteLabelClientRecord = {
  id: string;
  spaces: WhiteLabelSpaceRecord[];
};

export type WhiteLabelConfig = {
  clients: WhiteLabelClientRecord[];
};

export type ResolveOptions = {
  /** Locale codes accepted as the optional segment after the Space slug. */
  locales: readonly string[];
  defaultLocale: string;
  /**
   * Raw `Accept-Language` header. Used only when the path carries no locale
   * (a cookie is not an option: cross-site frames do not send `SameSite=Lax`).
   */
  acceptLanguage?: string | null;
};

export type ResolvedSpace = {
  /** Client ids that approved this Space (config order). */
  clientIds: string[];
  spaceSlug: string;
  locale: string;
  /** Union of the approving clients' framing origins for this Space. */
  framingOrigins: string[];
};

export type NotFoundReason =
  | 'internal-prefix'
  | 'unapproved-space'
  | 'malformed-path'
  | 'api-not-served';

export type ResolveDecision =
  /** Not white label: handled by the existing middleware chain. */
  | { kind: 'pass' }
  /** Serve the internal tree. `pathname` is the internal `/wl/...` path. */
  | ({ kind: 'rewrite'; pathname: string } & ResolvedSpace)
  /** Not served: unapproved slug, internal prefix reached from outside, odd path. */
  | { kind: 'not-found'; reason: NotFoundReason };
