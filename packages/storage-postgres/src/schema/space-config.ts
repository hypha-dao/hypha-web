import { json, pgTable, text } from 'drizzle-orm/pg-core';
import { spaces } from './space';
import { commonDateFields } from './shared';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const spaceConfigs = pgTable('space_configs', {
  spaceSlug: text('space_slug')
    .references(() => spaces.slug)
    .notNull()
    .primaryKey(),
  storage: json('storage')
    .$type<{
      space?: 'postgres' | 'memory';
      agreement?: 'postgres' | 'memory';
      member?: 'postgres' | 'memory';
      comment?: 'postgres' | 'memory';
    }>()
    .notNull()
    .default({
      space: 'postgres',
      agreement: 'postgres',
      member: 'postgres',
      comment: 'postgres',
    }),
  createdAt: commonDateFields.createdAt,
  updatedAt: commonDateFields.updatedAt,
});

export type SpaceConfig = InferSelectModel<typeof spaceConfigs>;
export type NewSpaceConfig = InferInsertModel<typeof spaceConfigs>;
