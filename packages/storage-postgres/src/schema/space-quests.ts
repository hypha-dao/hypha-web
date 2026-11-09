import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';
import { documents } from './document';

export type QuestRewardItem = {
  amount: string;
  token: string;
};

export type QuestUpdateLinkItem = {
  label: string;
  url: string;
  kind?: 'pr' | 'preview' | 'doc' | 'link';
};

export type QuestUpdateChangeItem = {
  label: string;
  format: 'text' | 'short';
  action: 'updated' | 'added' | 'removed' | 'reordered';
  before?: string | null;
  after?: string | null;
};

export type QuestUpdateChangePayload = {
  entity: 'quest' | 'milestone' | 'member' | 'deliverable';
  field: string;
  action: 'updated' | 'added' | 'removed' | 'reordered';
  before?: string | null;
  after?: string | null;
  format?: 'text' | 'short';
  items?: QuestUpdateChangeItem[];
};

/**
 * Space Quest (ex-Project) — goal, scope, success criteria, multi-token reward,
 * milestones, members with responsibilities, deliverables, health, and updates.
 * Note: Priority is intentionally omitted (Hard Rule #4).
 */
export const spaceQuests = pgTable(
  'space_quests',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    goal: text('goal').notNull().default(''),
    scopeIn: jsonb('scope_in').$type<string[]>().notNull().default([]),
    scopeOut: jsonb('scope_out').$type<string[]>().notNull().default([]),
    scopeInMarkdown: text('scope_in_markdown').notNull().default(''),
    scopeOutMarkdown: text('scope_out_markdown').notNull().default(''),
    successCriteria: text('success_criteria').notNull().default(''),
    rewards: jsonb('rewards').$type<QuestRewardItem[]>().notNull().default([]),
    status: text('status').notNull().default('proposed'),
    targetDate: text('target_date'),
    leadPersonId: integer('lead_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    leadName: text('lead_name'),
    creatorPersonId: integer('creator_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    proposalDocumentId: integer('proposal_document_id').references(
      () => documents.id,
      { onDelete: 'set null' },
    ),
    acceptedAt: timestamp('accepted_at'),
    chatRoomId: text('chat_room_id'),
    healthState: text('health_state').notNull().default('on_track'),
    healthMarker: integer('health_marker').notNull().default(80),
    healthSummary: text('health_summary').notNull().default(''),
    healthUpdatedAt: timestamp('health_updated_at'),
    stewardHealthSummaries: boolean('steward_health_summaries')
      .notNull()
      .default(true),
    memberUpdateAlerts: boolean('member_update_alerts').notNull().default(true),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_quests_space_slug_unique').on(table.spaceId, table.slug),
    index('space_quests_space_id_idx').on(table.spaceId),
    index('space_quests_proposal_document_id_idx').on(table.proposalDocumentId),
  ],
);

export const spaceQuestMilestones = pgTable(
  'space_quest_milestones',
  {
    id: serial('id').primaryKey(),
    questId: integer('quest_id')
      .notNull()
      .references(() => spaceQuests.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(1),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    dueDate: text('due_date'),
    ownerPersonId: integer('owner_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    ownerName: text('owner_name'),
    status: text('status').notNull().default('not_started'),
    ...commonDateFields,
  },
  (table) => [index('space_quest_milestones_quest_id_idx').on(table.questId)],
);

export const spaceQuestMembers = pgTable(
  'space_quest_members',
  {
    id: serial('id').primaryKey(),
    questId: integer('quest_id')
      .notNull()
      .references(() => spaceQuests.id, { onDelete: 'cascade' }),
    personId: integer('person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    memberName: text('member_name').notNull(),
    memberAvatarUrl: text('member_avatar_url'),
    roleLabel: text('role_label'),
    responsibilities: jsonb('responsibilities')
      .$type<string[]>()
      .notNull()
      .default([]),
    order: integer('order').notNull().default(1),
    ...commonDateFields,
  },
  (table) => [index('space_quest_members_quest_id_idx').on(table.questId)],
);

export const spaceQuestDeliverables = pgTable(
  'space_quest_deliverables',
  {
    id: serial('id').primaryKey(),
    questId: integer('quest_id')
      .notNull()
      .references(() => spaceQuests.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url'),
    note: text('note'),
    order: integer('order').notNull().default(1),
    updatedByPersonId: integer('updated_by_person_id').references(
      () => people.id,
      { onDelete: 'set null' },
    ),
    updatedByName: text('updated_by_name'),
    ...commonDateFields,
  },
  (table) => [index('space_quest_deliverables_quest_id_idx').on(table.questId)],
);

/**
 * Unfinished create-quest form for one member. Private to the author.
 * Not a quest row and not an agreement.
 */
export const spaceQuestDrafts = pgTable(
  'space_quest_drafts',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    authorPersonId: integer('author_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default(''),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    ...commonDateFields,
  },
  (table) => [
    index('space_quest_drafts_space_author_idx').on(
      table.spaceId,
      table.authorPersonId,
    ),
  ],
);

export const spaceQuestUpdates = pgTable(
  'space_quest_updates',
  {
    id: serial('id').primaryKey(),
    questId: integer('quest_id')
      .notNull()
      .references(() => spaceQuests.id, { onDelete: 'cascade' }),
    authorPersonId: integer('author_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name').notNull(),
    authorAvatarUrl: text('author_avatar_url'),
    kind: text('kind').notNull().default('post'),
    viaAgent: boolean('via_agent').notNull().default(false),
    milestoneOrder: integer('milestone_order'),
    milestoneLabel: text('milestone_label'),
    text: text('text').notNull(),
    links: jsonb('links').$type<QuestUpdateLinkItem[]>().notNull().default([]),
    change: jsonb('change').$type<QuestUpdateChangePayload | null>(),
    ...commonDateFields,
  },
  (table) => [index('space_quest_updates_quest_id_idx').on(table.questId)],
);

export type SpaceQuestDraft = InferSelectModel<typeof spaceQuestDrafts>;
export type NewSpaceQuestDraft = InferInsertModel<typeof spaceQuestDrafts>;
export type SpaceQuest = InferSelectModel<typeof spaceQuests>;
export type NewSpaceQuest = InferInsertModel<typeof spaceQuests>;
export type SpaceQuestMilestone = InferSelectModel<typeof spaceQuestMilestones>;
export type NewSpaceQuestMilestone = InferInsertModel<
  typeof spaceQuestMilestones
>;
export type SpaceQuestMember = InferSelectModel<typeof spaceQuestMembers>;
export type NewSpaceQuestMember = InferInsertModel<typeof spaceQuestMembers>;
export type SpaceQuestDeliverable = InferSelectModel<
  typeof spaceQuestDeliverables
>;
export type NewSpaceQuestDeliverable = InferInsertModel<
  typeof spaceQuestDeliverables
>;
export type SpaceQuestUpdate = InferSelectModel<typeof spaceQuestUpdates>;
export type NewSpaceQuestUpdate = InferInsertModel<typeof spaceQuestUpdates>;
