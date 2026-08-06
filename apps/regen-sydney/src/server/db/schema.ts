import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * The campaign's own schema, in the campaign's own database.
 *
 * This deliberately shares nothing with the Hypha platform database. The
 * campaign is a small app that takes money and counts votes; Hypha is the
 * platform of record for a live DAO. Giving the campaign write access to
 * Hypha's tables would mean any bug here — a bad migration, a careless
 * delete, a runaway seed — could damage the platform. The blast radius is
 * kept to this database instead.
 *
 * Identity still lines up across the two, because both authenticate against
 * the same Privy app: the `sub` stored below is the same subject Hypha stores.
 * Anything richer about a person (display name, avatar) is read from Hypha's
 * public API at request time — see server/hypha-profiles.ts — and never
 * written back.
 *
 * Voting is settled entirely in Postgres; there is no ballot contract. The
 * only on-chain artefact is the RSUT mint mirroring each grant, so members
 * genuinely hold the token while the ledger here stays the source of truth for
 * voting power. Reading the ledger rather than `balanceOf` also sidesteps
 * RSUT's decay.
 */

const commonDateFields = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};

export const CAMPAIGN_PROJECT_GROUPS = [
  'initiative',
  'program',
  'enabling',
] as const;
export const campaignProjectGroup = pgEnum(
  'campaign_project_group',
  CAMPAIGN_PROJECT_GROUPS,
);

export const CAMPAIGN_CYCLE_STATUSES = ['open', 'closed'] as const;
export const campaignCycleStatus = pgEnum(
  'campaign_cycle_status',
  CAMPAIGN_CYCLE_STATUSES,
);

/** `join` is the one-off first-login bonus; `contribution` is a settled payment. */
export const CAMPAIGN_GRANT_KINDS = ['join', 'contribution', 'manual'] as const;
export const campaignGrantKind = pgEnum(
  'campaign_grant_kind',
  CAMPAIGN_GRANT_KINDS,
);

/**
 * `skipped` means no relayer is configured, so the ledger entry stands alone.
 * Everything except `confirmed` and `skipped` is safe to retry.
 */
export const CAMPAIGN_MINT_STATUSES = [
  'pending',
  'sent',
  'confirmed',
  'failed',
  'skipped',
] as const;
export const campaignMintStatus = pgEnum(
  'campaign_mint_status',
  CAMPAIGN_MINT_STATUSES,
);

export const CAMPAIGN_PAYMENT_STATUSES = [
  'pending',
  'settled',
  'refunded',
  'cancelled',
] as const;
export const campaignPaymentStatus = pgEnum(
  'campaign_payment_status',
  CAMPAIGN_PAYMENT_STATUSES,
);

/**
 * A contributor. Keyed on the Privy subject, which is the same value Hypha
 * keys its own `people` rows on — so the two can be correlated later without
 * either system writing to the other.
 *
 * Only what the campaign itself needs is stored: who to attribute a grant to,
 * where to mint, and how to address them in the admin ledger.
 */
export const campaignMembers = pgTable(
  'campaign_members',
  {
    id: serial('id').primaryKey(),
    /** Privy `sub`. The same person on Hypha carries the same value. */
    sub: text('sub').notNull().unique(),
    email: text('email'),
    name: text('name'),
    /** Where RSUT is minted. Null until Privy reports an ethereum wallet. */
    walletAddress: text('wallet_address'),
    ...commonDateFields,
  },
  (table) => [
    index('campaign_members_email_idx').on(table.email),
    index('campaign_members_wallet_idx').on(table.walletAddress),
  ],
);

export const campaignProjects = pgTable(
  'campaign_projects',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    program: text('program').notNull().default(''),
    group: campaignProjectGroup('group').notNull().default('initiative'),
    summary: text('summary').notNull().default(''),
    team: text('team').notNull().default(''),
    videoUrl: text('video_url'),
    imageUrl: text('image_url'),
    /** Where the grant is actually paid out; distribution itself is manual. */
    payoutAddress: text('payout_address'),
    payoutNote: text('payout_note'),
    /** Hidden projects stay on past ballots but drop off the current one. */
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...commonDateFields,
  },
  (table) => [index('campaign_projects_active_idx').on(table.active)],
);

export const campaignCycles = pgTable(
  'campaign_cycles',
  {
    id: serial('id').primaryKey(),
    number: integer('number').notNull().unique(),
    name: text('name').notNull(),
    status: campaignCycleStatus('status').notNull().default('open'),
    startsAt: timestamp('starts_at').notNull().defaultNow(),
    endsAt: timestamp('ends_at').notNull(),
    durationDays: integer('duration_days').notNull().default(21),
    /** Philanthropic match on community contributions. 1 = dollar for dollar. */
    matchMultiplier: numeric('match_multiplier', { precision: 6, scale: 3 })
      .notNull()
      .default('1'),
    closedAt: timestamp('closed_at'),
    ...commonDateFields,
  },
  (table) => [
    index('campaign_cycles_status_idx').on(table.status),
    // Only one round can accept votes at a time, enforced by the database
    // rather than by whichever code path happens to open the next one.
    uniqueIndex('campaign_cycles_single_open_idx')
      .on(table.status)
      .where(sql`${table.status} = 'open'`),
  ],
);

/**
 * The grants ledger. A row is written *before* the on-chain mint is attempted,
 * so a slow or failed mint can be retried without ever double-granting.
 * `idempotencyKey` is what makes a replayed payment webhook a no-op.
 */
export const campaignGrants = pgTable(
  'campaign_grants',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => campaignMembers.id),
    /** Null for the joining bonus, which is not tied to a round. */
    cycleId: integer('cycle_id').references(() => campaignCycles.id),
    kind: campaignGrantKind('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),

    /** Granted voting power, in whole RSUT. 1 RSUT = A$1. */
    rsut: numeric('rsut', { precision: 20, scale: 6 }).notNull(),
    /** Integer cents, so money never touches a float. */
    audCents: integer('aud_cents').notNull().default(0),

    paymentProvider: text('payment_provider'),
    paymentReference: text('payment_reference'),
    paymentStatus: campaignPaymentStatus('payment_status')
      .notNull()
      .default('settled'),

    mintStatus: campaignMintStatus('mint_status').notNull().default('pending'),
    mintTxHash: text('mint_tx_hash'),
    mintAttempts: integer('mint_attempts').notNull().default(0),
    mintError: text('mint_error'),
    /** Snapshot of the wallet at grant time; the mint must not chase a moving target. */
    mintToAddress: text('mint_to_address'),

    note: text('note'),
    ...commonDateFields,
  },
  (table) => [
    index('campaign_grants_member_idx').on(table.memberId),
    index('campaign_grants_mint_status_idx').on(table.mintStatus),
    uniqueIndex('campaign_grants_payment_ref_idx').on(
      table.paymentProvider,
      table.paymentReference,
    ),
  ],
);

/** One row per (cycle, member, project). Revoting overwrites the weight. */
export const campaignVotes = pgTable(
  'campaign_votes',
  {
    id: serial('id').primaryKey(),
    cycleId: integer('cycle_id')
      .notNull()
      .references(() => campaignCycles.id),
    memberId: integer('member_id')
      .notNull()
      .references(() => campaignMembers.id),
    projectId: integer('project_id')
      .notNull()
      .references(() => campaignProjects.id),
    weight: numeric('weight', { precision: 20, scale: 6 })
      .notNull()
      .default('0'),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('campaign_votes_unique_idx').on(
      table.cycleId,
      table.memberId,
      table.projectId,
    ),
    index('campaign_votes_cycle_project_idx').on(
      table.cycleId,
      table.projectId,
    ),
  ],
);

/**
 * The allocation worksheet frozen when a cycle closes. Funds land in the admin
 * account and are transferred by hand, so this is a record of intent that the
 * admin ticks off — not an instruction to any contract.
 */
export const campaignPayouts = pgTable(
  'campaign_payouts',
  {
    id: serial('id').primaryKey(),
    cycleId: integer('cycle_id')
      .notNull()
      .references(() => campaignCycles.id),
    projectId: integer('project_id')
      .notNull()
      .references(() => campaignProjects.id),
    votes: numeric('votes', { precision: 20, scale: 6 }).notNull().default('0'),
    share: numeric('share', { precision: 10, scale: 8 }).notNull().default('0'),
    amountCents: integer('amount_cents').notNull().default(0),
    paidAt: timestamp('paid_at'),
    paidReference: text('paid_reference'),
    note: text('note'),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('campaign_payouts_unique_idx').on(
      table.cycleId,
      table.projectId,
    ),
  ],
);

export const campaignGrantRelations = relations(campaignGrants, ({ one }) => ({
  member: one(campaignMembers, {
    fields: [campaignGrants.memberId],
    references: [campaignMembers.id],
  }),
  cycle: one(campaignCycles, {
    fields: [campaignGrants.cycleId],
    references: [campaignCycles.id],
  }),
}));

export const campaignVoteRelations = relations(campaignVotes, ({ one }) => ({
  member: one(campaignMembers, {
    fields: [campaignVotes.memberId],
    references: [campaignMembers.id],
  }),
  cycle: one(campaignCycles, {
    fields: [campaignVotes.cycleId],
    references: [campaignCycles.id],
  }),
  project: one(campaignProjects, {
    fields: [campaignVotes.projectId],
    references: [campaignProjects.id],
  }),
}));

export const campaignPayoutRelations = relations(
  campaignPayouts,
  ({ one }) => ({
    cycle: one(campaignCycles, {
      fields: [campaignPayouts.cycleId],
      references: [campaignCycles.id],
    }),
    project: one(campaignProjects, {
      fields: [campaignPayouts.projectId],
      references: [campaignProjects.id],
    }),
  }),
);

export const schema = {
  campaignMembers,
  campaignProjects,
  campaignCycles,
  campaignGrants,
  campaignVotes,
  campaignPayouts,
  campaignGrantRelations,
  campaignVoteRelations,
  campaignPayoutRelations,
};

export type CampaignMember = InferSelectModel<typeof campaignMembers>;
export type NewCampaignMember = InferInsertModel<typeof campaignMembers>;
export type CampaignProject = InferSelectModel<typeof campaignProjects>;
export type NewCampaignProject = InferInsertModel<typeof campaignProjects>;
export type CampaignCycle = InferSelectModel<typeof campaignCycles>;
export type NewCampaignCycle = InferInsertModel<typeof campaignCycles>;
export type CampaignGrant = InferSelectModel<typeof campaignGrants>;
export type NewCampaignGrant = InferInsertModel<typeof campaignGrants>;
export type CampaignVote = InferSelectModel<typeof campaignVotes>;
export type NewCampaignVote = InferInsertModel<typeof campaignVotes>;
export type CampaignPayout = InferSelectModel<typeof campaignPayouts>;
export type NewCampaignPayout = InferInsertModel<typeof campaignPayouts>;
