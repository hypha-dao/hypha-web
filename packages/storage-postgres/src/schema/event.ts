import { InferSelectModel, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { EVENT_ENTITY_TYPES } from './event-types';

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // Polymorphic reference
    referenceId: integer('reference_id').notNull(),
    referenceEntity: text('reference_entity', {
      enum: EVENT_ENTITY_TYPES,
    }).notNull(),
    parameters: jsonb('params').notNull().default({}),
  },
  (table) => [
    index('events_reference_idx').on(table.referenceEntity, table.referenceId),
    index('events_type_idx').on(table.type),
    index('events_created_at_idx').on(table.createdAt),
  ],
);

export type Event = InferSelectModel<typeof events>;

export type EventReference =
  | { entity: 'person'; id: number }
  | { entity: 'space'; id: number }
  | { entity: 'document'; id: number }
  | { entity: 'token'; id: number };
