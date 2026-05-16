import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { spaces } from './space';
import { coherences } from './coherence';
import { commonDateFields } from './shared';

export const signalOrchestratorQueue = pgTable(
  'signal_orchestrator_queue',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    state: varchar('state', { length: 32 }).notNull().default('pending'),
    triggerKind: varchar('trigger_kind', { length: 64 }).notNull(),
    eventCount: integer('event_count').notNull().default(1),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamp('due_at').notNull().defaultNow(),
    processingStartedAt: timestamp('processing_started_at'),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastError: text('last_error'),
    ...commonDateFields,
  },
  (table) => [
    index('signal_orchestrator_queue_space_idx').on(table.spaceId),
    index('signal_orchestrator_queue_state_due_idx').on(
      table.state,
      table.dueAt,
    ),
    index('signal_orchestrator_queue_created_idx').on(table.createdAt),
  ],
);

export const signalOrchestratorCooldowns = pgTable(
  'signal_orchestrator_cooldowns',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 128 }).notNull(),
    cooldownUntil: timestamp('cooldown_until').notNull(),
    reason: text('reason'),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('signal_orchestrator_cooldowns_space_key_unique').on(
      table.spaceId,
      table.key,
    ),
    index('signal_orchestrator_cooldowns_space_key_idx').on(
      table.spaceId,
      table.key,
    ),
    index('signal_orchestrator_cooldowns_until_idx').on(table.cooldownUntil),
  ],
);

export const signalOrchestratorDispatches = pgTable(
  'signal_orchestrator_dispatches',
  {
    id: serial('id').primaryKey(),
    queueId: integer('queue_id').references(() => signalOrchestratorQueue.id, {
      onDelete: 'set null',
    }),
    sourceSpaceId: integer('source_space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    targetSpaceId: integer('target_space_id').references(() => spaces.id, {
      onDelete: 'set null',
    }),
    emittedSignalId: integer('emitted_signal_id').references(
      () => coherences.id,
      {
        onDelete: 'set null',
      },
    ),
    mode: varchar('mode', { length: 32 }).notNull(),
    decision: varchar('decision', { length: 32 }).notNull(),
    relevanceScore: integer('relevance_score').notNull().default(0),
    noveltyScore: integer('novelty_score').notNull().default(0),
    actionabilityScore: integer('actionability_score').notNull().default(0),
    confidenceScore: integer('confidence_score').notNull().default(0),
    rationale: text('rationale'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...commonDateFields,
  },
  (table) => [
    index('signal_orchestrator_dispatches_source_idx').on(table.sourceSpaceId),
    index('signal_orchestrator_dispatches_target_idx').on(table.targetSpaceId),
    index('signal_orchestrator_dispatches_mode_decision_idx').on(
      table.mode,
      table.decision,
    ),
    index('signal_orchestrator_dispatches_created_idx').on(table.createdAt),
  ],
);

export type SignalOrchestratorQueue = InferSelectModel<
  typeof signalOrchestratorQueue
>;
export type NewSignalOrchestratorQueue = InferInsertModel<
  typeof signalOrchestratorQueue
>;

export type SignalOrchestratorCooldown = InferSelectModel<
  typeof signalOrchestratorCooldowns
>;
export type NewSignalOrchestratorCooldown = InferInsertModel<
  typeof signalOrchestratorCooldowns
>;

export type SignalOrchestratorDispatch = InferSelectModel<
  typeof signalOrchestratorDispatches
>;
export type NewSignalOrchestratorDispatch = InferInsertModel<
  typeof signalOrchestratorDispatches
>;
