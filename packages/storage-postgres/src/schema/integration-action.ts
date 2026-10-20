import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { people } from './people';
import { integrationClients } from './integration-client';

/**
 * `expired` is not stored: a `pending` row past `expires_at` is reported as
 * expired when read.
 */
export const INTEGRATION_ACTION_STATUSES = [
  'pending',
  'approved',
  'submitted',
  'rejected',
  'failed',
] as const;
export type IntegrationActionStatus =
  (typeof INTEGRATION_ACTION_STATUSES)[number];

/**
 * An operation an integration client asked for on behalf of a person, waiting
 * for that person to approve it on a Hypha page (spike, #2515). Bound to one
 * client and one person, single use, short expiry. `context` is a snapshot
 * resolved by the server at request time and is what the approval page shows.
 *
 * Deliberately has no RLS read policy: rows are read through authenticated API
 * routes only.
 */
export const integrationActions = pgTable(
  'integration_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: integer('client_id')
      .notNull()
      .references(() => integrationClients.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    operation: varchar('operation', { length: 32 }).notNull(),
    parameters: jsonb('parameters').$type<Record<string, unknown>>().notNull(),
    context: jsonb('context').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 16 })
      .$type<IntegrationActionStatus>()
      .notNull()
      .default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    txHash: varchar('tx_hash', { length: 80 }),
    ...commonDateFields,
  },
  (table) => [
    index('integration_actions_client_person_idx').on(
      table.clientId,
      table.personId,
    ),
  ],
);

export type IntegrationAction = InferSelectModel<typeof integrationActions>;
export type NewIntegrationAction = InferInsertModel<typeof integrationActions>;
