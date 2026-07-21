import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

export const pipelineSavedViews = pgTable(
  'pipeline_saved_views',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    filters: jsonb('filters')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    sort: jsonb('sort').$type<Record<string, unknown>>().notNull().default({}),
    ...commonDateFields,
  },
  (table) => [
    index('pipeline_saved_views_space_person_idx').on(
      table.spaceId,
      table.personId,
    ),
    uniqueIndex('pipeline_saved_views_space_person_name_uidx').on(
      table.spaceId,
      table.personId,
      table.name,
    ),
  ],
);

export type PipelineSavedView = InferSelectModel<typeof pipelineSavedViews>;
export type NewPipelineSavedView = InferInsertModel<typeof pipelineSavedViews>;
