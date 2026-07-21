import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { spaces } from './space';

export const spaceHighlightProfiles = pgTable(
  'space_highlight_profiles',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at'),
    summary: text('summary'),
    coverImageUrl: text('cover_image_url'),
    goalAmount: numeric('goal_amount'),
    goalCurrency: text('goal_currency'),
    blocks: jsonb('blocks').$type<unknown[]>().notNull().default([]),
    supportActions: jsonb('support_actions')
      .$type<unknown[]>()
      .notNull()
      .default([]),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_highlight_profiles_space_id_uidx').on(table.spaceId),
  ],
);

export const spaceHighlightProfilesRelations = relations(
  spaceHighlightProfiles,
  ({ one }) => ({
    space: one(spaces, {
      fields: [spaceHighlightProfiles.spaceId],
      references: [spaces.id],
    }),
  }),
);

export type SpaceHighlightProfile = InferSelectModel<
  typeof spaceHighlightProfiles
>;
export type NewSpaceHighlightProfile = InferInsertModel<
  typeof spaceHighlightProfiles
>;
