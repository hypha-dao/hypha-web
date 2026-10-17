import {
  integrationClients,
  integrationGrants,
} from '@hypha-platform/storage-postgres';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import type { IntegrationClientScope } from '../../integration-client/types';
import type {
  IntegrationGrantSummary,
  IntegrationGrantWithClient,
} from '../types';

type GrantRow = typeof integrationGrants.$inferSelect;

/** Built field by field so only intended columns leave the module. */
export function toGrantSummary(row: GrantRow): IntegrationGrantSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    personId: row.personId,
    scopes: row.scopes as IntegrationClientScope[],
    status: row.status,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * The active grant of a person for a client that covers a scope, or null.
 * This is what the write pipeline asks before signing anything (M4).
 */
export const findActiveGrant = async (
  {
    clientId,
    personId,
    scope,
  }: { clientId: number; personId: number; scope?: IntegrationClientScope },
  { db }: DbConfig,
): Promise<IntegrationGrantSummary | null> => {
  const [row] = await db
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
  if (!row) return null;
  const grant = toGrantSummary(row);
  if (scope && !grant.scopes.includes(scope)) return null;
  return grant;
};

/**
 * One person's grants for one client (active first, then history). Scoped by
 * client in the query itself, so another client's rows cannot be returned.
 */
export const listIntegrationGrantsForClientPerson = async (
  { clientId, personId }: { clientId: number; personId: number },
  { db }: DbConfig,
): Promise<IntegrationGrantSummary[]> => {
  const rows = await db
    .select()
    .from(integrationGrants)
    .where(
      and(
        eq(integrationGrants.clientId, clientId),
        eq(integrationGrants.personId, personId),
      ),
    )
    .orderBy(
      sql`case when ${integrationGrants.status} = 'active' then 0 else 1 end`,
      desc(integrationGrants.grantedAt),
    );
  return rows.map(toGrantSummary);
};

/** A person's grants (active first, then history), with the client identity. */
export const listIntegrationGrantsForPerson = async (
  { personId }: { personId: number },
  { db }: DbConfig,
): Promise<IntegrationGrantWithClient[]> => {
  const rows = await db
    .select({
      grant: integrationGrants,
      clientSlug: integrationClients.slug,
      clientName: integrationClients.name,
    })
    .from(integrationGrants)
    .innerJoin(
      integrationClients,
      eq(integrationClients.id, integrationGrants.clientId),
    )
    .where(eq(integrationGrants.personId, personId))
    .orderBy(
      sql`case when ${integrationGrants.status} = 'active' then 0 else 1 end`,
      desc(integrationGrants.grantedAt),
    );

  return rows.map((row) => ({
    ...toGrantSummary(row.grant),
    client: { slug: row.clientSlug, name: row.clientName },
  }));
};
