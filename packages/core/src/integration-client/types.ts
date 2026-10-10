export const INTEGRATION_CLIENT_SCOPES = ['agreements:vote'] as const;

export type IntegrationClientScope = (typeof INTEGRATION_CLIENT_SCOPES)[number];

export type IntegrationClientStatus = 'pending' | 'approved' | 'revoked';

/** Client metadata safe to return over the wire — never includes the digest. */
export type IntegrationClientSummary = {
  id: number;
  name: string;
  slug: string;
  contactEmail: string;
  description: string | null;
  status: IntegrationClientStatus;
  scopes: IntegrationClientScope[];
  allowedOrigins: string[];
  keyPrefix: string | null;
  requestedByPersonId: number | null;
  approvedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export function isIntegrationClientScope(
  value: string,
): value is IntegrationClientScope {
  return (INTEGRATION_CLIENT_SCOPES as readonly string[]).includes(value);
}

/**
 * Lifecycle: pending → approved → revoked, or pending → revoked (rejection).
 * `revoked` is terminal. Key rotation is only meaningful while approved.
 */
const ALLOWED_TRANSITIONS: Record<
  IntegrationClientStatus,
  readonly IntegrationClientStatus[]
> = {
  pending: ['approved', 'revoked'],
  approved: ['revoked'],
  revoked: [],
};

export function canTransitionClientStatus(
  from: IntegrationClientStatus,
  to: IntegrationClientStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
