import { integrationGrants } from '@hypha-platform/storage-postgres';
import { and, eq, sql } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import type { IntegrationClientScope } from '../../integration-client/types';
import type { IntegrationGrantSummary } from '../types';
import { toGrantSummary } from './queries';

/** First key of the two-key advisory lock taken per (client, person). */
const GRANT_LOCK_NAMESPACE = 2516;

/**
 * Record a person's trust in a client for `scopes`. Idempotent: when an
 * active grant already exists its scopes are replaced with the new set (the
 * same authenticated act as the first registration). Serialized per
 * (client, person) so concurrent calls cannot trip the unique index.
 */
export const registerIntegrationGrant = async (
  {
    clientId,
    personId,
    scopes,
  }: {
    clientId: number;
    personId: number;
    scopes: IntegrationClientScope[];
  },
  { db }: DbConfig,
): Promise<IntegrationGrantSummary> => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${GRANT_LOCK_NAMESPACE}, hashtext(${`${clientId}:${personId}`}))`,
    );

    const [existing] = await tx
      .select()
      .from(integrationGrants)
      .where(
        and(
          eq(integrationGrants.clientId, clientId),
          eq(integrationGrants.personId, personId),
          eq(integrationGrants.status, 'active'),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(integrationGrants)
        .set({ scopes, updatedAt: new Date() })
        .where(eq(integrationGrants.id, existing.id))
        .returning();
      if (!updated) throw new Error('Failed to update integration grant');
      return toGrantSummary(updated);
    }

    const [row] = await tx
      .insert(integrationGrants)
      .values({ clientId, personId, scopes })
      .returning();
    if (!row) throw new Error('Failed to persist integration grant');
    return toGrantSummary(row);
  });
};

/**
 * Revoke a grant. The person must own it; pass `clientId` when the client is
 * the one revoking so it can only touch its own grants.
 * @returns true when this call revoked an active grant.
 */
export const revokeIntegrationGrant = async (
  {
    grantId,
    personId,
    clientId,
  }: { grantId: number; personId: number; clientId?: number },
  { db }: DbConfig,
): Promise<boolean> => {
  const now = new Date();
  const rows = await db
    .update(integrationGrants)
    .set({ status: 'revoked', revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(integrationGrants.id, grantId),
        eq(integrationGrants.personId, personId),
        eq(integrationGrants.status, 'active'),
        ...(clientId === undefined
          ? []
          : [eq(integrationGrants.clientId, clientId)]),
      ),
    )
    .returning();
  return rows.length > 0;
};
