import { spaceApiKeys } from '@hypha-platform/storage-postgres';
import { and, desc, eq, isNull } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import type { SpaceApiKeyScope, SpaceApiKeySummary } from '../types';

/** Columns safe to hand back to callers — deliberately excludes `keyHash`. */
const summaryColumns = {
  id: spaceApiKeys.id,
  spaceId: spaceApiKeys.spaceId,
  name: spaceApiKeys.name,
  source: spaceApiKeys.source,
  keyPrefix: spaceApiKeys.keyPrefix,
  scopes: spaceApiKeys.scopes,
  createdByPersonId: spaceApiKeys.createdByPersonId,
  lastUsedAt: spaceApiKeys.lastUsedAt,
  revokedAt: spaceApiKeys.revokedAt,
  createdAt: spaceApiKeys.createdAt,
};

function toSummary(row: {
  id: number;
  spaceId: number;
  name: string;
  source: string;
  keyPrefix: string;
  scopes: string[];
  createdByPersonId: number | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): SpaceApiKeySummary {
  return { ...row, scopes: row.scopes as SpaceApiKeyScope[] };
}

/**
 * Look up a non-revoked key by its SHA-256 digest. Callers must still verify
 * the digest with a timing-safe comparison and check the space and scopes.
 */
export const findActiveSpaceApiKeyByHash = async (
  { keyHash }: { keyHash: string },
  { db }: DbConfig,
) => {
  const [row] = await db
    .select()
    .from(spaceApiKeys)
    .where(
      and(eq(spaceApiKeys.keyHash, keyHash), isNull(spaceApiKeys.revokedAt)),
    )
    .limit(1);
  return row ?? null;
};

export const listSpaceApiKeys = async (
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<SpaceApiKeySummary[]> => {
  const rows = await db
    .select(summaryColumns)
    .from(spaceApiKeys)
    .where(eq(spaceApiKeys.spaceId, spaceId))
    .orderBy(desc(spaceApiKeys.createdAt));
  return rows.map(toSummary);
};

export const findSpaceApiKeyById = async (
  { id, spaceId }: { id: number; spaceId: number },
  { db }: DbConfig,
): Promise<SpaceApiKeySummary | null> => {
  const [row] = await db
    .select(summaryColumns)
    .from(spaceApiKeys)
    .where(and(eq(spaceApiKeys.id, id), eq(spaceApiKeys.spaceId, spaceId)))
    .limit(1);
  return row ? toSummary(row) : null;
};
