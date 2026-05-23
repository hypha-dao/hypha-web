import {
  bigint,
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

export const threadSummaries = pgTable(
  'thread_summaries',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    matrixRoomId: text('matrix_room_id').notNull(),
    threadKind: varchar('thread_kind', { length: 32 }).notNull(),
    coherenceSlug: varchar('coherence_slug', { length: 255 }),
    threadTitle: varchar('thread_title', { length: 512 }),
    summary: text('summary').notNull().default(''),
    bullets: jsonb('bullets').$type<string[]>().notNull().default([]),
    messageCount: integer('message_count').notNull().default(0),
    participantCount: integer('participant_count').notNull().default(0),
    lastSummarizedEventId: text('last_summarized_event_id'),
    lastMessageEventId: text('last_message_event_id'),
    lastMessageOriginServerTs: bigint('last_message_origin_server_ts', {
      mode: 'number',
    }),
    lastSummarizedOriginServerTs: bigint('last_summarized_origin_server_ts', {
      mode: 'number',
    }),
    lastRefreshedAt: timestamp('last_refreshed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    source: varchar('source', { length: 128 }).notNull().default('llm'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('thread_summaries_space_room_unique').on(
      table.spaceId,
      table.matrixRoomId,
    ),
    index('thread_summaries_space_idx').on(table.spaceId),
    index('thread_summaries_updated_idx').on(table.updatedAt),
  ],
);

export type ThreadSummary = InferSelectModel<typeof threadSummaries>;
export type NewThreadSummary = InferInsertModel<typeof threadSummaries>;
