import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';
import { coherences } from './coherence';

export const SCHEDULED_ITEM_TYPES = [
  'call',
  'event',
  'meeting',
  'booking',
] as const;

export type ScheduledItemType = (typeof SCHEDULED_ITEM_TYPES)[number];

export const spaceScheduledItems = pgTable(
  'space_scheduled_items',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    creatorId: integer('creator_id')
      .notNull()
      .references(() => people.id),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type', { enum: SCHEDULED_ITEM_TYPES }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    timezone: text('timezone'),
    location: text('location'),
    meetingUrl: text('meeting_url'),
    color: text('color'),
    recurrenceRule: text('recurrence_rule'),
    recurrenceUntil: timestamp('recurrence_until', { withTimezone: true }),
    matrixRoomId: text('matrix_room_id'),
    matrixAutoLink: boolean('matrix_auto_link').notNull().default(false),
    reminderMinutesBefore: integer('reminder_minutes_before'),
    coherenceId: integer('coherence_id'),
    ...commonDateFields,
  },
  (table) => [
    index('space_scheduled_items_space_id_idx').on(table.spaceId),
    index('space_scheduled_items_starts_at_idx').on(table.startsAt),
    index('space_scheduled_items_space_starts_idx').on(
      table.spaceId,
      table.startsAt,
    ),
    index('space_scheduled_items_type_idx').on(table.type),
    index('space_scheduled_items_reminder_due_idx')
      .on(table.reminderMinutesBefore, table.startsAt)
      .where(sql`${table.reminderMinutesBefore} IS NOT NULL`),
    index('space_scheduled_items_space_coherence_idx')
      .on(table.spaceId, table.coherenceId)
      .where(sql`${table.coherenceId} IS NOT NULL`),
    foreignKey({
      name: 'space_scheduled_items_coherence_space_fk',
      columns: [table.coherenceId, table.spaceId],
      foreignColumns: [coherences.id, coherences.spaceId],
    }).onDelete('set null'),
  ],
);

export const spaceScheduledItemReminderDispatches = pgTable(
  'space_scheduled_item_reminder_dispatches',
  {
    id: serial('id').primaryKey(),
    scheduledItemId: integer('scheduled_item_id')
      .notNull()
      .references(() => spaceScheduledItems.id, { onDelete: 'cascade' }),
    occurrenceStartsAt: timestamp('occurrence_starts_at', {
      withTimezone: true,
    }).notNull(),
    channel: text('channel', { enum: ['email', 'push'] }).notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('space_scheduled_item_reminder_unique').on(
      table.scheduledItemId,
      table.occurrenceStartsAt,
      table.channel,
    ),
    index('space_scheduled_item_reminder_item_idx').on(table.scheduledItemId),
  ],
);

export type SpaceScheduledItem = InferSelectModel<typeof spaceScheduledItems>;
export type NewSpaceScheduledItem = InferInsertModel<
  typeof spaceScheduledItems
>;
export type SpaceScheduledItemReminderDispatch = InferSelectModel<
  typeof spaceScheduledItemReminderDispatches
>;

export const spaceScheduledItemInvitationDispatches = pgTable(
  'space_scheduled_item_invitation_dispatches',
  {
    id: serial('id').primaryKey(),
    scheduledItemId: integer('scheduled_item_id')
      .notNull()
      .references(() => spaceScheduledItems.id, { onDelete: 'cascade' }),
    inviteRevision: text('invite_revision').notNull(),
    channel: text('channel', { enum: ['email', 'push'] }).notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('space_scheduled_item_invitation_unique').on(
      table.scheduledItemId,
      table.inviteRevision,
      table.channel,
    ),
    index('space_scheduled_item_invitation_item_idx').on(table.scheduledItemId),
  ],
);

export type SpaceScheduledItemInvitationDispatch = InferSelectModel<
  typeof spaceScheduledItemInvitationDispatches
>;
