import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { people } from './people';
import { integrationClients } from './integration-client';

export const INTEGRATION_GRANT_STATUSES = ['active', 'revoked'] as const;
export type IntegrationGrantStatus =
  (typeof INTEGRATION_GRANT_STATUSES)[number];

/**
 * A person's trust in an integration client for a set of scopes (#2515). This
 * is Hypha's own authorization record; the wallet signer is a separate,
 * technical capability checked when the server signs. Rows are kept after
 * revocation as history.
 *
 * Deliberately has no RLS read policy: grants are read through authenticated
 * API routes only.
 */
export const integrationGrants = pgTable(
  'integration_grants',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id')
      .notNull()
      .references(() => integrationClients.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    status: varchar('status', { length: 16 })
      .$type<IntegrationGrantStatus>()
      .notNull()
      .default('active'),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...commonDateFields,
  },
  (table) => [
    // One active grant per (client, person); revoked rows stay as history.
    uniqueIndex('integration_grants_active_unique')
      .on(table.clientId, table.personId)
      .where(sql`${table.status} = 'active'`),
    index('integration_grants_person_idx').on(table.personId),
  ],
);

export type IntegrationGrant = InferSelectModel<typeof integrationGrants>;
export type NewIntegrationGrant = InferInsertModel<typeof integrationGrants>;
