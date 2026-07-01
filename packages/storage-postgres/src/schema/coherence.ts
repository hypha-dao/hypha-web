import {
  boolean,
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
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

export const coherences = pgTable(
  'coherences',
  {
    id: serial('id').primaryKey(),
    creatorId: integer('creator_id')
      .notNull()
      .references(() => people.id),
    spaceId: integer('space_id').references(() => spaces.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    type: text('type').notNull(),
    priority: text('priority').default('medium'),
    slug: varchar('slug', { length: 255 }),
    roomId: text('room_id'),
    archived: boolean('archived').default(false),
    views: integer('views').default(0),
    messages: integer('messages').default(0),
    tags: jsonb('tags').$type<Array<string>>().notNull().default([]),
    dueAt: timestamp('due_at', { withTimezone: true }),
    progressStatus: text('progress_status'),
    board: text('board'),
    assigneeIds: jsonb('assignee_ids').$type<number[]>().notNull().default([]),
    ...commonDateFields,
  },
  (table) => [
    index('search_index_coherences').using(
      'gin',
      sql`(
          setweight(to_tsvector('english', ${table.title}), 'A') ||
          setweight(to_tsvector('english', ${table.description}), 'B')
      )`,
    ),
    index('search_type').on(table.type),
    index('search_priority').on(table.priority),
    uniqueIndex('unique_slug').on(table.slug),
    index('search_room_id').on(table.roomId),
    index('search_archived').on(table.archived),
    index('search_views').on(table.views),
    index('search_messages').on(table.messages),
    index('search_tags').using('gin', table.tags),
    index('coherences_space_progress_status_idx').on(
      table.spaceId,
      table.progressStatus,
    ),
    index('coherences_space_board_idx').on(table.spaceId, table.board),
    index('coherences_due_at_idx')
      .on(table.dueAt)
      .where(sql`${table.dueAt} IS NOT NULL`),
    index('coherences_assignee_ids_idx').using('gin', table.assigneeIds),
  ],
);

export type Coherence = InferSelectModel<typeof coherences>;
export type NewCoherence = InferInsertModel<typeof coherences>;
