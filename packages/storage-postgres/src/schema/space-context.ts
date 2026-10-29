import {
  integer,
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

/**
 * Per-space Context section (Mission, Vision, …). Markdown is the source of
 * truth for humans and later MCP/agent reads.
 */
export const spaceContextSections = pgTable(
  'space_context_sections',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    sectionKey: text('section_key').notNull(),
    markdown: text('markdown').notNull().default(''),
    status: text('status').notNull().default('not_started'),
    version: integer('version').notNull().default(1),
    proposalDocumentId: integer('proposal_document_id').references(
      () => documents.id,
      { onDelete: 'set null' },
    ),
    ratifiedDocumentId: integer('ratified_document_id').references(
      () => documents.id,
      { onDelete: 'set null' },
    ),
    ratifiedAt: timestamp('ratified_at'),
    updatedByPersonId: integer('updated_by_person_id').references(
      () => people.id,
      { onDelete: 'set null' },
    ),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_context_sections_space_key_unique').on(
      table.spaceId,
      table.sectionKey,
    ),
    index('space_context_sections_space_id_idx').on(table.spaceId),
    index('space_context_sections_proposal_document_id_idx').on(
      table.proposalDocumentId,
    ),
  ],
);

/** Shared drafting thread for a Context section (members + specialist). */
export const spaceContextSectionMessages = pgTable(
  'space_context_section_messages',
  {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id')
      .notNull()
      .references(() => spaceContextSections.id, { onDelete: 'cascade' }),
    personId: integer('person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    agentKey: text('agent_key'),
    role: text('role').notNull(),
    content: text('content').notNull(),
    ...commonDateFields,
  },
  (table) => [
    index('space_context_section_messages_section_id_idx').on(table.sectionId),
  ],
);

/** Long-lived notes for the specialist of one section type in a space. */
export const spaceContextAgentMemories = pgTable(
  'space_context_agent_memories',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    sectionKey: text('section_key').notNull(),
    agentKey: text('agent_key').notNull(),
    memoryMarkdown: text('memory_markdown').notNull().default(''),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_context_agent_memories_unique').on(
      table.spaceId,
      table.sectionKey,
      table.agentKey,
    ),
  ],
);

export type SpaceContextSection = InferSelectModel<typeof spaceContextSections>;
export type NewSpaceContextSection = InferInsertModel<
  typeof spaceContextSections
>;
export type SpaceContextSectionMessage = InferSelectModel<
  typeof spaceContextSectionMessages
>;
export type NewSpaceContextSectionMessage = InferInsertModel<
  typeof spaceContextSectionMessages
>;
export type SpaceContextAgentMemory = InferSelectModel<
  typeof spaceContextAgentMemories
>;
export type NewSpaceContextAgentMemory = InferInsertModel<
  typeof spaceContextAgentMemories
>;
