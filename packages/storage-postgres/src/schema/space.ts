import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const spaces = pgTable('spaces', {
  id: text('id').primaryKey(),
  logoUrl: text('logo_url'),
  leadImage: text('lead_image'),
  title: text('title').notNull(),
  description: text('description'),
  slug: text('slug').notNull().unique(),
  parentId: text('parent_id').references(() => spaces.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
