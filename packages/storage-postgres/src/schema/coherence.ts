import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { COHERENCE_STATUSES } from './coherence-statuses';
import { COHERENCE_TAGS } from './coherence-tags';
import { COHERENCE_TYPES } from './coherence-types';

export const coherenceStatusEnum = pgEnum(
  'coherence_status',
  COHERENCE_STATUSES,
);
export const coherenceTagsEnum = pgEnum('coherence_tags', COHERENCE_TAGS);
export const coherenceTypeEnum = pgEnum('coherence_type', COHERENCE_TYPES);

export const coherences = pgTable(
  'coherences',
  {
    id: serial('id').primaryKey(),
    creatorId: integer('creator_id').notNull(),
    spaceId: integer('space_id').references(() => spaces.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: coherenceStatusEnum('status').default('signal'),
    type: coherenceTypeEnum('type').notNull(),
    slug: varchar('slug', { length: 255 }),
    roomId: text('room_id'),
    archived: boolean().default(false),
    tags: jsonb('tags')
      .$type<Array<(typeof coherenceTagsEnum.enumValues)[number]>>()
      .notNull()
      .default([]),
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
  ],
);

export type Coherence = InferSelectModel<typeof coherences>;
export type NewCoherence = InferInsertModel<typeof coherences>;
