import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

/**
 * Credentials that let a community's own app write into a single space
 * (currently signals). Only the SHA-256 digest of the key is stored — the
 * plaintext is shown once at issuance and cannot be recovered afterwards.
 *
 * Deliberately has no RLS read policy: key rows are never selected by any
 * member-facing route, because a space can be fully public.
 */
export const spaceApiKeys = pgTable(
  'space_api_keys',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    /** Human label for the integration, e.g. "ACAW contest app". */
    name: text('name').notNull(),
    /** Stable slug stamped onto every signal the key writes. */
    source: varchar('source', { length: 64 }).notNull(),
    /** Leading segment of the plaintext key, for identifying it in lists and logs. */
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    createdByPersonId: integer('created_by_person_id').references(
      () => people.id,
      { onDelete: 'set null' },
    ),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_api_keys_key_hash_unique').on(table.keyHash),
    uniqueIndex('space_api_keys_space_source_unique').on(
      table.spaceId,
      table.source,
    ),
    index('space_api_keys_space_revoked_idx').on(
      table.spaceId,
      table.revokedAt,
    ),
  ],
);

export type SpaceApiKey = InferSelectModel<typeof spaceApiKeys>;
export type NewSpaceApiKey = InferInsertModel<typeof spaceApiKeys>;
