import { integrationClients } from '@hypha-platform/storage-postgres';
import { desc, eq } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import type {
  IntegrationClientScope,
  IntegrationClientSummary,
} from '../types';

/** Columns safe to hand back to callers — deliberately excludes `keyHash`. */
export const clientSummaryColumns = {
  id: integrationClients.id,
  name: integrationClients.name,
  slug: integrationClients.slug,
  contactEmail: integrationClients.contactEmail,
  description: integrationClients.description,
  status: integrationClients.status,
  scopes: integrationClients.scopes,
  allowedOrigins: integrationClients.allowedOrigins,
  keyPrefix: integrationClients.keyPrefix,
  approvedAt: integrationClients.approvedAt,
  revokedAt: integrationClients.revokedAt,
  createdAt: integrationClients.createdAt,
};

/** Built field by field so the digest can never leak into a response. */
export function toClientSummary(
  row: Omit<IntegrationClientSummary, 'scopes'> & { scopes: string[] },
): IntegrationClientSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    contactEmail: row.contactEmail,
    description: row.description,
    status: row.status,
    scopes: row.scopes as IntegrationClientScope[],
    allowedOrigins: row.allowedOrigins,
    keyPrefix: row.keyPrefix,
    approvedAt: row.approvedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Look up a client by key digest, whatever its status, so that authentication
 * can tell a revoked client apart from an unknown key. Callers must still
 * compare the digest in constant time and check status and scopes.
 */
export const findIntegrationClientByKeyHash = async (
  { keyHash }: { keyHash: string },
  { db }: DbConfig,
) => {
  const [row] = await db
    .select()
    .from(integrationClients)
    .where(eq(integrationClients.keyHash, keyHash))
    .limit(1);
  return row ?? null;
};

export const findIntegrationClientBySlug = async (
  { slug }: { slug: string },
  { db }: DbConfig,
): Promise<IntegrationClientSummary | null> => {
  const [row] = await db
    .select(clientSummaryColumns)
    .from(integrationClients)
    .where(eq(integrationClients.slug, slug))
    .limit(1);
  return row ? toClientSummary(row) : null;
};

export const listIntegrationClients = async ({
  db,
}: DbConfig): Promise<IntegrationClientSummary[]> => {
  const rows = await db
    .select(clientSummaryColumns)
    .from(integrationClients)
    .orderBy(desc(integrationClients.createdAt));
  return rows.map(toClientSummary);
};
