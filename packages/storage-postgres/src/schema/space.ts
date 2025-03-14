import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';

export const spaces = pgTable('spaces', {
  id: serial('id').primaryKey(),
  logoUrl: text('logo_url'),
  leadImage: text('lead_image'),
  title: text('title').notNull(),
  description: text('description'),
  slug: text('slug').notNull().unique(),
  web3SpaceId: integer('web3_space_id'),
  ...commonDateFields,
});

export type Space = InferSelectModel<typeof spaces>;
export type NewSpace = InferInsertModel<typeof spaces>;
