import { sql } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { people } from './people';
import { spaces } from './space';

/**
 * An in-app invitation to join a space. The row stays pending until the
 * invitee is an on-chain member of that space.
 */
export const spaceMemberInvites = pgTable(
  'space_member_invites',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id),
    inviterPersonId: integer('inviter_person_id')
      .notNull()
      .references(() => people.id),
    inviteePersonId: integer('invitee_person_id')
      .notNull()
      .references(() => people.id),
    token: text('token').notNull(),
    acceptedAt: timestamp('accepted_at'),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_member_invites_token_unique').on(table.token),
    uniqueIndex('space_member_invite_pending_idx')
      .on(table.spaceId, table.inviteePersonId)
      .where(sql`${table.acceptedAt} IS NULL`),
  ],
);
