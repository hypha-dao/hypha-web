import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';

export const spaces = pgTable('spaces', {
  ...commonDateFields,
  logoUrl: text('logo_url'),
  leadImage: text('lead_image'),
  title: text('title').notNull(),
  description: text('description'),
  slug: text('slug').notNull().unique(),
});

export type Space = InferSelectModel<typeof spaces>;
export type NewSpace = InferInsertModel<typeof spaces>;
