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

export const spaceCallRecordings = pgTable(
  'space_call_recordings',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    callSessionId: varchar('call_session_id', { length: 128 }).notNull(),
    mediaUri: text('media_uri').notNull(),
    storageKey: text('storage_key'),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    durationSeconds: integer('duration_seconds'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    source: varchar('source', { length: 128 }).notNull().default('unknown'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_call_recordings_space_session_unique').on(
      table.spaceId,
      table.callSessionId,
    ),
    index('space_call_recordings_space_idx').on(table.spaceId),
    index('space_call_recordings_created_idx').on(table.createdAt),
  ],
);

export const spaceCallTranscripts = pgTable(
  'space_call_transcripts',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    callSessionId: varchar('call_session_id', { length: 128 }).notNull(),
    language: varchar('language', { length: 32 }).notNull().default('und'),
    text: text('text').notNull(),
    summary: text('summary'),
    source: varchar('source', { length: 128 }).notNull().default('unknown'),
    segments: jsonb('segments').$type<Array<Record<string, unknown>>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_call_transcripts_space_session_unique').on(
      table.spaceId,
      table.callSessionId,
    ),
    index('space_call_transcripts_space_idx').on(table.spaceId),
    index('space_call_transcripts_created_idx').on(table.createdAt),
  ],
);

export const spaceDiscussionSummaries = pgTable(
  'space_discussion_summaries',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    matrixRoomId: text('matrix_room_id').notNull(),
    summary: text('summary').notNull(),
    bullets: jsonb('bullets').$type<string[]>().notNull().default([]),
    messageCount: integer('message_count').notNull().default(0),
    participantCount: integer('participant_count').notNull().default(0),
    source: varchar('source', { length: 128 }).notNull().default('heuristic'),
    windowStart: timestamp('window_start', {
      withTimezone: true,
      mode: 'string',
    }),
    windowEnd: timestamp('window_end', {
      withTimezone: true,
      mode: 'string',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...commonDateFields,
  },
  (table) => [
    index('space_discussion_summaries_space_idx').on(table.spaceId),
    index('space_discussion_summaries_room_idx').on(table.matrixRoomId),
    index('space_discussion_summaries_created_idx').on(table.createdAt),
  ],
);

export type SpaceCallRecording = InferSelectModel<typeof spaceCallRecordings>;
export type NewSpaceCallRecording = InferInsertModel<
  typeof spaceCallRecordings
>;

export type SpaceCallTranscript = InferSelectModel<typeof spaceCallTranscripts>;
export type NewSpaceCallTranscript = InferInsertModel<
  typeof spaceCallTranscripts
>;

export type SpaceDiscussionSummary = InferSelectModel<
  typeof spaceDiscussionSummaries
>;
export type NewSpaceDiscussionSummary = InferInsertModel<
  typeof spaceDiscussionSummaries
>;
