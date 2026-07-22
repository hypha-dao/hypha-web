import {
  integer,
  jsonb,
  pgTable,
  serial,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

export const pipelineUserSettings = pgTable(
  'pipeline_user_settings',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    countryFocus: jsonb('country_focus')
      .$type<string[]>()
      .notNull()
      .default([]),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('pipeline_user_settings_space_person_uidx').on(
      table.spaceId,
      table.personId,
    ),
  ],
);

export type PipelineUserSettings = InferSelectModel<
  typeof pipelineUserSettings
>;
export type NewPipelineUserSettings = InferInsertModel<
  typeof pipelineUserSettings
>;
