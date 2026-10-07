import {
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { commonDateFields } from './shared';

export const INTEGRATION_CLIENT_STATUSES = [
  'pending',
  'approved',
  'revoked',
] as const;
export type IntegrationClientStatus =
  (typeof INTEGRATION_CLIENT_STATUSES)[number];

/**
 * External apps (B2B integrators) approved to act on behalf of consenting
 * users through the server-mediated write path (#2515). Separate from
 * `space_api_keys`: those are space-scoped, signal-only credentials, these are
 * cross-space and compose with a per-call user identity.
 *
 * Only the SHA-256 digest of the key is stored — the plaintext is shown once at
 * approval. Deliberately has no RLS read policy: rows are never member-facing.
 */
export const integrationClients = pgTable(
  'integration_clients',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** Stable identifier for logs and ops URLs. */
    slug: varchar('slug', { length: 64 }).notNull(),
    contactEmail: text('contact_email').notNull(),
    description: text('description'),
    status: varchar('status', { length: 16 })
      .$type<IntegrationClientStatus>()
      .notNull()
      .default('pending'),
    /** Filled from the request; ops may edit before approving. */
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    /** Origins hosting the integrator's login; also used to configure Privy. */
    allowedOrigins: jsonb('allowed_origins')
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Leading segment of the plaintext key; null until approved. */
    keyPrefix: varchar('key_prefix', { length: 16 }),
    keyHash: text('key_hash'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('integration_clients_slug_unique').on(table.slug),
    uniqueIndex('integration_clients_key_hash_unique')
      .on(table.keyHash)
      .where(sql`${table.keyHash} IS NOT NULL`),
  ],
);

export type IntegrationClient = InferSelectModel<typeof integrationClients>;
export type NewIntegrationClient = InferInsertModel<typeof integrationClients>;
