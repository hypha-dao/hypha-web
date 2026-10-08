import { integrationClients } from '@hypha-platform/storage-postgres';
import { and, count, eq, inArray } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import { generateClientKey } from '../generate-client-key';
import type {
  IntegrationClientScope,
  IntegrationClientSummary,
} from '../types';
import {
  schemaRequestIntegrationClient,
  slugifyClientName,
  type RequestIntegrationClientInput,
} from '../validation';
import { toClientSummary } from './queries';

/** Pending requests one person may have open at a time. */
export const MAX_PENDING_REQUESTS_PER_PERSON = 3;

export class TooManyPendingRequestsError extends Error {
  constructor() {
    super('Too many pending integration client requests for this person');
    this.name = 'TooManyPendingRequestsError';
  }
}

export type IssuedClientKey = {
  client: IntegrationClientSummary;
  /** Returned exactly once — it cannot be recovered from the database. */
  plaintext: string;
};

/**
 * A new client starts `pending` with no key; ops approve it separately.
 * Requests require a logged-in Hypha person, capped at
 * `MAX_PENDING_REQUESTS_PER_PERSON` open requests.
 * Throws a unique violation on `integration_clients_slug_unique` when the
 * derived slug is taken — callers map that to a 409.
 */
export const requestIntegrationClient = async (
  input: RequestIntegrationClientInput,
  { requestedByPersonId }: { requestedByPersonId: number },
  { db }: DbConfig,
): Promise<IntegrationClientSummary> => {
  const data = schemaRequestIntegrationClient.parse(input);

  const [pending] = await db
    .select({ value: count() })
    .from(integrationClients)
    .where(
      and(
        eq(integrationClients.requestedByPersonId, requestedByPersonId),
        eq(integrationClients.status, 'pending'),
      ),
    );
  if ((pending?.value ?? 0) >= MAX_PENDING_REQUESTS_PER_PERSON) {
    throw new TooManyPendingRequestsError();
  }

  const [row] = await db
    .insert(integrationClients)
    .values({
      name: data.name,
      slug: slugifyClientName(data.name),
      contactEmail: data.contactEmail,
      description: data.description ?? null,
      scopes: data.scopes,
      allowedOrigins: data.allowedOrigins,
      requestedByPersonId,
    })
    .returning();

  if (!row) throw new Error('Failed to persist integration client request');
  return toClientSummary(row);
};

/**
 * pending → approved, issuing the key. Conditional on `pending` so a repeated
 * or concurrent approval cannot issue two keys.
 * @returns null when the client is not pending (or does not exist).
 */
export const approveIntegrationClient = async (
  { slug, scopes }: { slug: string; scopes?: IntegrationClientScope[] },
  { db }: DbConfig,
): Promise<IssuedClientKey | null> => {
  const { plaintext, prefix, hash } = generateClientKey();
  const now = new Date();

  const [row] = await db
    .update(integrationClients)
    .set({
      status: 'approved',
      keyPrefix: prefix,
      keyHash: hash,
      approvedAt: now,
      updatedAt: now,
      ...(scopes ? { scopes } : {}),
    })
    .where(
      and(
        eq(integrationClients.slug, slug),
        eq(integrationClients.status, 'pending'),
      ),
    )
    .returning();

  return row ? { client: toClientSummary(row), plaintext } : null;
};

/**
 * Replace the key in place (hard cut-over: the old key stops working at once).
 * @returns null when the client is not approved.
 */
export const rotateIntegrationClientKey = async (
  { slug }: { slug: string },
  { db }: DbConfig,
): Promise<IssuedClientKey | null> => {
  const { plaintext, prefix, hash } = generateClientKey();

  const [row] = await db
    .update(integrationClients)
    .set({ keyPrefix: prefix, keyHash: hash, updatedAt: new Date() })
    .where(
      and(
        eq(integrationClients.slug, slug),
        eq(integrationClients.status, 'approved'),
      ),
    )
    .returning();

  return row ? { client: toClientSummary(row), plaintext } : null;
};

/**
 * pending|approved → revoked. The key digest is kept so a revoked key is
 * reported as revoked rather than unknown.
 * @returns true when this call revoked the client.
 */
export const revokeIntegrationClient = async (
  { slug }: { slug: string },
  { db }: DbConfig,
): Promise<boolean> => {
  const now = new Date();
  const rows = await db
    .update(integrationClients)
    .set({ status: 'revoked', revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(integrationClients.slug, slug),
        inArray(integrationClients.status, ['pending', 'approved']),
      ),
    )
    .returning();
  return rows.length > 0;
};
