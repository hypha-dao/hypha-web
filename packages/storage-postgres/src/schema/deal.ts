import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

export type DealContact = {
  firstName?: string;
  lastName?: string;
  role?: string;
  dept?: string;
  email?: string;
  mobile?: string;
  linkedin?: string;
  isPrimary?: boolean;
  contactType?: string;
};

export const deals = pgTable(
  'deals',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    ownerId: integer('owner_id')
      .notNull()
      .references(() => people.id),
    title: text('title').notNull(),
    pipelineSwimlane: text('pipeline_swimlane').notNull(),
    pipelineStatus: text('pipeline_status').notNull(),
    status: text('status').notNull().default('active'),
    priority: text('priority').notNull().default('medium'),
    value: numeric('value', { precision: 18, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('€'),
    country: text('country'),
    region: text('region').notNull().default('Global'),
    contacts: jsonb('contacts').$type<DealContact[]>().notNull().default([]),
    contactPerson: text('contact_person'),
    contactEmail: text('contact_email'),
    linkedinUrl: text('linkedin_url'),
    contactUrl: text('contact_url'),
    teamMemberIds: jsonb('team_member_ids')
      .$type<number[]>()
      .notNull()
      .default([]),
    accountManagerId: integer('account_manager_id').references(() => people.id),
    /** Per-deal success-rate override (0–100); null = use stage default. */
    successRate: integer('success_rate'),
    nextAction: text('next_action'),
    nextActionDate: date('next_action_date'),
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    blocked: boolean('blocked').notNull().default(false),
    blockerReason: text('blocker_reason'),
    submissionDeadline: date('submission_deadline'),
    fundingRateSme: numeric('funding_rate_sme', { precision: 8, scale: 2 }),
    maxProjectSize: numeric('max_project_size', { precision: 18, scale: 2 }),
    expectedPartners: text('expected_partners'),
    isConsortiumLead: boolean('is_consortium_lead'),
    eligibleCountries: jsonb('eligible_countries')
      .$type<string[]>()
      .notNull()
      .default([]),
    callReference: text('call_reference'),
    programme: text('programme'),
    eligibilityNotes: text('eligibility_notes'),
    ...commonDateFields,
  },
  (table) => [
    index('deals_space_id_idx').on(table.spaceId),
    index('deals_space_swimlane_idx').on(table.spaceId, table.pipelineSwimlane),
    index('deals_space_status_idx').on(table.spaceId, table.pipelineStatus),
  ],
);

export type Deal = InferSelectModel<typeof deals>;
export type NewDeal = InferInsertModel<typeof deals>;
