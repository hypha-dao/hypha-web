import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { categories } from './categories';
import { AnyPgColumn } from 'drizzle-orm/pg-core';

export const spaces = pgTable(
  'spaces',
  {
    id: serial('id').primaryKey(),
    logoUrl: text('logo_url'),
    leadImage: text('lead_image'),
    title: text('title').notNull(),
    description: text('description').notNull().default('SHOULD NOT BE EMPTY'),
    slug: text('slug').notNull().unique(),
    web3SpaceId: integer('web3_space_id'),
    links: jsonb('links').$type<string[]>().notNull().default([]),
    categories: jsonb('categories')
      .$type<Array<(typeof categories.enumValues)[number]>>()
      .notNull()
      .default([]),
    parentId: integer('parent_id').references((): AnyPgColumn => spaces.id),
    ...commonDateFields,
  },
  (table) => [
    index('search_index_spaces').using(
      'gin',
      sql`(
          setweight(to_tsvector('english', ${table.title}), 'A') ||
          setweight(to_tsvector('english', ${table.description}), 'B')
      )`,
    ),
  ],
);

export type Space = InferSelectModel<typeof spaces>;
export type NewSpace = InferInsertModel<typeof spaces>;
