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
    creatorId: integer('creator_id').references(() => people.id),
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
    /**
     * Amounts that name the ask or resource. Same shape as a contribution
     * proposal payout (`amount` + token address) so a signal can become a
     * proposal, but nothing here moves funds.
     */
    indicativePayouts: jsonb('indicative_payouts')
      .$type<Array<{ amount: string; token: string }>>()
      .notNull()
      .default([]),
    /** Uploaded image for the signal. A URL, not a file blob. */
    leadImage: text('lead_image'),
    /** A link to a video hosted elsewhere. Nothing is uploaded. */
    videoUrl: text('video_url'),
    /**
     * When true, this signal may be offered to members outside its space.
     * Off by default. Nothing here is visible to the network until a member turns it on.
     */
    sharedWithNetwork: boolean('shared_with_network').notNull().default(false),
    /** Documents linked the same way as a proposal attachment. */
    attachments: jsonb('attachments')
      .$type<Array<{ name: string; url: string }>>()
      .notNull()
      .default([]),
    /** `space_api_keys.source` when the signal arrived from a community app. */
    source: text('source'),
    /** The external app's own identifier for the record, used for idempotency. */
    externalId: text('external_id'),
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
    uniqueIndex('coherences_id_space_id_key').on(table.id, table.spaceId),
    index('coherences_space_due_at_idx')
      .on(table.spaceId, table.dueAt)
      .where(sql`${table.dueAt} IS NOT NULL AND ${table.archived} = false`),
    index('coherences_assignee_ids_idx').using('gin', table.assigneeIds),
    uniqueIndex('coherences_space_source_external_id_unique')
      .on(table.spaceId, table.source, table.externalId)
      .where(
        sql`${table.spaceId} IS NOT NULL AND ${table.source} IS NOT NULL AND ${table.externalId} IS NOT NULL`,
      ),
  ],
);

export type Coherence = InferSelectModel<typeof coherences>;
export type NewCoherence = InferInsertModel<typeof coherences>;
