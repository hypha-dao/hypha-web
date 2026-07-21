import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { categories } from './categories';
import { spaceFlags } from './flags';
import { AnyPgColumn } from 'drizzle-orm/pg-core';

export const spaces = pgTable(
  'spaces',
  {
    id: serial('id').primaryKey(),
    logoUrl: text('logo_url'),
    ecosystemLogoUrlLight: text('ecosystem_logo_url_light'),
    ecosystemLogoUrlDark: text('ecosystem_logo_url_dark'),
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
    address: text('web3_address'),
    isArchived: boolean('is_archived').notNull().default(false),
    flags: jsonb('flags')
      .$type<Array<(typeof spaceFlags.enumValues)[number]>>()
      .notNull()
      .default([]),
    /** Canonical Matrix room id for space-level chat (!id:server). */
    chatRoomId: text('chat_room_id'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    locationLabel: text('location_label'),
    locationSource: text('location_source'),
    locatedAt: timestamp('located_at'),
    signalWorkflow: jsonb('signal_workflow')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** When true, Deal Pipeline tab and APIs are available for this space. */
    pipelineEnabled: boolean('pipeline_enabled').notNull().default(false),
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
