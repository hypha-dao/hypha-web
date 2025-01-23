import { pgTable, timestamp, text, json } from 'drizzle-orm/pg-core';
import { spaces } from './space';

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
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
