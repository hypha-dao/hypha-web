import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  documents,
  people,
  spaceContextAgentMemories,
  spaceContextSectionMessages,
  spaceContextSections,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  SPACE_CONTEXT_SECTION_KEYS,
  SPACE_CONTEXT_SECTION_ORDER,
  SPACE_CONTEXT_SPECIALISTS,
  type SpaceContextSectionKey,
} from '../constants';
import type {
  SpaceContextAgentMemoryRecord,
  SpaceContextMessageRecord,
  SpaceContextOverview,
  SpaceContextSectionDetail,
  SpaceContextSectionRecord,
} from '../types';
import { mapSectionRow } from './map-row';

async function ensureSectionsForSpace(
  spaceId: number,
  { db }: DbConfig,
): Promise<void> {
  const existing = await db
    .select({ sectionKey: spaceContextSections.sectionKey })
    .from(spaceContextSections)
    .where(eq(spaceContextSections.spaceId, spaceId));
  const have = new Set(existing.map((row) => row.sectionKey));
  const missing = SPACE_CONTEXT_SECTION_KEYS.filter((key) => !have.has(key));
  if (missing.length === 0) return;

  await db.insert(spaceContextSections).values(
    missing.map((sectionKey) => ({
      spaceId,
      sectionKey,
      markdown: '',
      status: 'not_started',
    })),
  );
}

function sortSections(
  sections: SpaceContextSectionRecord[],
): SpaceContextSectionRecord[] {
  return [...sections].sort(
    (a, b) =>
      SPACE_CONTEXT_SECTION_ORDER[a.sectionKey] -
      SPACE_CONTEXT_SECTION_ORDER[b.sectionKey],
  );
}

export async function listSpaceContextSections(
  { spaceSlug }: { spaceSlug: string },
  { db }: DbConfig,
): Promise<SpaceContextOverview | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;

  await ensureSectionsForSpace(space.id, { db });

  const ratifiedDocuments = alias(documents, 'ratified_documents');
  const rows = await db
    .select({
      section: spaceContextSections,
      proposalTitle: documents.title,
      proposalSlug: documents.slug,
      proposalWeb3Id: documents.web3ProposalId,
      ratifiedTitle: ratifiedDocuments.title,
      ratifiedSlug: ratifiedDocuments.slug,
      ratifiedWeb3Id: ratifiedDocuments.web3ProposalId,
      lastEditorName: sql<
        string | null
      >`trim(concat_ws(' ', ${people.name}, ${people.surname}))`,
    })
    .from(spaceContextSections)
    .leftJoin(
      documents,
      eq(documents.id, spaceContextSections.proposalDocumentId),
    )
    .leftJoin(
      ratifiedDocuments,
      eq(ratifiedDocuments.id, spaceContextSections.ratifiedDocumentId),
    )
    .leftJoin(people, eq(people.id, spaceContextSections.updatedByPersonId))
    .where(eq(spaceContextSections.spaceId, space.id));

  const sectionIds = rows.map((row) => row.section.id);
  const contributorRows =
    sectionIds.length === 0
      ? []
      : await db
          .select({
            sectionId: spaceContextSectionMessages.sectionId,
            count: sql<number>`count(distinct ${spaceContextSectionMessages.personId})::int`,
          })
          .from(spaceContextSectionMessages)
          .where(
            and(
              inArray(spaceContextSectionMessages.sectionId, sectionIds),
              sql`${spaceContextSectionMessages.personId} is not null`,
            ),
          )
          .groupBy(spaceContextSectionMessages.sectionId);

  const contributorBySection = new Map(
    contributorRows.map((row) => [row.sectionId, Number(row.count) || 0]),
  );

  const sections = sortSections(
    rows
      .map((row) =>
        mapSectionRow(row.section, {
          proposalTitle: row.proposalTitle,
          proposalSlug: row.proposalSlug,
          proposalWeb3Id: row.proposalWeb3Id,
          ratifiedTitle: row.ratifiedTitle,
          ratifiedSlug: row.ratifiedSlug,
          ratifiedWeb3Id: row.ratifiedWeb3Id,
          contributorCount: contributorBySection.get(row.section.id) ?? 0,
          lastEditorName: row.lastEditorName,
        }),
      )
      .filter((row): row is SpaceContextSectionRecord => row != null),
  );

  return {
    spaceSlug: space.slug,
    spaceTitle: space.title,
    sections,
    ratifiedCount: sections.filter((section) => section.status === 'ratified')
      .length,
    totalCount: SPACE_CONTEXT_SECTION_KEYS.length,
  };
}

export async function getSpaceContextSection(
  {
    spaceSlug,
    sectionKey,
  }: { spaceSlug: string; sectionKey: SpaceContextSectionKey },
  { db }: DbConfig,
): Promise<SpaceContextSectionDetail | null> {
  const overview = await listSpaceContextSections({ spaceSlug }, { db });
  if (!overview) return null;
  const section = overview.sections.find(
    (item) => item.sectionKey === sectionKey,
  );
  if (!section) return null;

  const messageRows = await db
    .select({
      id: spaceContextSectionMessages.id,
      sectionId: spaceContextSectionMessages.sectionId,
      personId: spaceContextSectionMessages.personId,
      agentKey: spaceContextSectionMessages.agentKey,
      role: spaceContextSectionMessages.role,
      content: spaceContextSectionMessages.content,
      createdAt: spaceContextSectionMessages.createdAt,
      personName: sql<
        string | null
      >`trim(concat_ws(' ', ${people.name}, ${people.surname}))`,
    })
    .from(spaceContextSectionMessages)
    .leftJoin(people, eq(people.id, spaceContextSectionMessages.personId))
    .where(eq(spaceContextSectionMessages.sectionId, section.id))
    .orderBy(desc(spaceContextSectionMessages.createdAt))
    .limit(200);

  const messages: SpaceContextMessageRecord[] = messageRows
    .reverse()
    .map((row) => ({
      id: row.id,
      sectionId: row.sectionId,
      personId: row.personId,
      personName: row.personName,
      agentKey: row.agentKey,
      role:
        row.role === 'assistant' || row.role === 'system' ? row.role : 'user',
      content: row.content,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString(),
    }));

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;

  const agentKey = SPACE_CONTEXT_SPECIALISTS[sectionKey].agentKey;
  const [memory] = await db
    .select()
    .from(spaceContextAgentMemories)
    .where(
      and(
        eq(spaceContextAgentMemories.spaceId, space.id),
        eq(spaceContextAgentMemories.sectionKey, sectionKey),
        eq(spaceContextAgentMemories.agentKey, agentKey),
      ),
    )
    .limit(1);

  const specialistMemory: SpaceContextAgentMemoryRecord | null = memory
    ? {
        spaceId: memory.spaceId,
        sectionKey,
        agentKey: memory.agentKey,
        memoryMarkdown: memory.memoryMarkdown,
        updatedAt:
          memory.updatedAt instanceof Date
            ? memory.updatedAt.toISOString()
            : new Date(memory.updatedAt).toISOString(),
      }
    : null;

  return { section, messages, specialistMemory };
}

export async function findSpaceContextSectionsByProposalDocumentId(
  { documentId }: { documentId: number },
  { db }: DbConfig,
): Promise<SpaceContextSectionRecord[]> {
  const rows = await db
    .select()
    .from(spaceContextSections)
    .where(eq(spaceContextSections.proposalDocumentId, documentId));
  return rows
    .map((row) => mapSectionRow(row))
    .filter((row): row is SpaceContextSectionRecord => row != null);
}

export async function findSpaceContextSectionsByWeb3ProposalId(
  { web3ProposalId }: { web3ProposalId: number },
  { db }: DbConfig,
): Promise<SpaceContextSectionRecord[]> {
  const rows = await db
    .select({ section: spaceContextSections })
    .from(spaceContextSections)
    .innerJoin(
      documents,
      eq(documents.id, spaceContextSections.proposalDocumentId),
    )
    .where(eq(documents.web3ProposalId, web3ProposalId));
  return rows
    .map((row) => mapSectionRow(row.section))
    .filter((row): row is SpaceContextSectionRecord => row != null);
}

export async function listRecentSpaceContextMessages(
  { sectionId, limit = 40 }: { sectionId: number; limit?: number },
  { db }: DbConfig,
): Promise<SpaceContextMessageRecord[]> {
  const rows = await db
    .select()
    .from(spaceContextSectionMessages)
    .where(eq(spaceContextSectionMessages.sectionId, sectionId))
    .orderBy(desc(spaceContextSectionMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((row) => ({
    id: row.id,
    sectionId: row.sectionId,
    personId: row.personId,
    personName: null,
    agentKey: row.agentKey,
    role: row.role === 'assistant' || row.role === 'system' ? row.role : 'user',
    content: row.content,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),
  }));
}
