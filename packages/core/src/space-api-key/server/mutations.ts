import { spaceApiKeys } from '@hypha-platform/storage-postgres';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import { generateSpaceApiKey } from '../generate-api-key';
import type { SpaceApiKeyScope, SpaceApiKeySummary } from '../types';

export type CreateSpaceApiKeyInput = {
  spaceId: number;
  name: string;
  source: string;
  scopes: SpaceApiKeyScope[];
  createdByPersonId?: number | null;
};

export type CreateSpaceApiKeyResult = {
  key: SpaceApiKeySummary;
  /** Returned exactly once — it cannot be recovered from the database. */
  plaintext: string;
};

export const createSpaceApiKey = async (
  {
    spaceId,
    name,
    source,
    scopes,
    createdByPersonId = null,
  }: CreateSpaceApiKeyInput,
  { db }: DbConfig,
): Promise<CreateSpaceApiKeyResult> => {
  const { plaintext, prefix, hash } = generateSpaceApiKey();

  const [row] = await db
    .insert(spaceApiKeys)
    .values({
      spaceId,
      name: name.trim(),
      source: source.trim(),
      keyPrefix: prefix,
      keyHash: hash,
      scopes,
      createdByPersonId,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to persist API key for spaceId=${spaceId}`);
  }

  // Built field by field so the digest can never leak into a response.
  return {
    key: {
      id: row.id,
      spaceId: row.spaceId,
      name: row.name,
      source: row.source,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes as SpaceApiKeyScope[],
      createdByPersonId: row.createdByPersonId,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    },
    plaintext,
  };
};

/** @returns true when an active key was revoked by this call. */
export const revokeSpaceApiKey = async (
  { id, spaceId }: { id: number; spaceId: number },
  { db }: DbConfig,
): Promise<boolean> => {
  const revoked = await db
    .update(spaceApiKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(spaceApiKeys.id, id),
        eq(spaceApiKeys.spaceId, spaceId),
        isNull(spaceApiKeys.revokedAt),
      ),
    )
    .returning();
  return revoked.length > 0;
};

/**
 * Record that a key was just used. Best-effort: a failure here must never
 * fail the request that the key authorised.
 */
export const touchSpaceApiKeyLastUsed = async (
  { id }: { id: number },
  { db }: DbConfig,
): Promise<void> => {
  try {
    await db
      .update(spaceApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(spaceApiKeys.id, id));
  } catch (error) {
    console.error('touchSpaceApiKeyLastUsed:', error);
  }
};
