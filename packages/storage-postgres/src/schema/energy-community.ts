import {
  bigint,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { spaces } from './space';
import { relations } from 'drizzle-orm';

export const energyCommunities = pgTable(
  'energy_communities',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    chainId: integer('chain_id').notNull().default(8453),
    communityProxyAddress: text('community_proxy_address').notNull(),
    energyTokenAddress: text('energy_token_address').notNull(),
    adminAddress: text('admin_address').notNull(),
    factoryCommunityId: bigint('factory_community_id', { mode: 'number' }),
    activatedAt: timestamp('activated_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('energy_communities_space_id_uidx').on(table.spaceId),
    uniqueIndex('energy_communities_proxy_uidx').on(
      table.communityProxyAddress,
    ),
    index('energy_communities_admin_idx').on(table.adminAddress),
  ],
);

export const energyCommunitiesRelations = relations(
  energyCommunities,
  ({ one }) => ({
    space: one(spaces, {
      fields: [energyCommunities.spaceId],
      references: [spaces.id],
    }),
  }),
);
