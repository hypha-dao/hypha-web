import type { IntegrationClientScope } from '../integration-client/types';

export type IntegrationGrantStatus = 'active' | 'revoked';

/** Grant metadata safe to return over the wire. */
export type IntegrationGrantSummary = {
  id: number;
  clientId: number;
  personId: number;
  scopes: IntegrationClientScope[];
  status: IntegrationGrantStatus;
  grantedAt: Date;
  revokedAt: Date | null;
};

/** A grant as listed for its owner, with the client's public identity. */
export type IntegrationGrantWithClient = IntegrationGrantSummary & {
  client: { slug: string; name: string };
};

/**
 * The scopes a grant gets: the requested ones, or all of the client's when
 * none were requested. Returns null when any requested scope is not one the
 * client holds (a grant can never exceed its client).
 */
export function resolveGrantScopes(
  clientScopes: readonly IntegrationClientScope[],
  requested?: readonly IntegrationClientScope[],
): IntegrationClientScope[] | null {
  if (!requested || requested.length === 0) return [...clientScopes];
  const unique = Array.from(new Set(requested));
  return unique.every((scope) => clientScopes.includes(scope)) ? unique : null;
}
