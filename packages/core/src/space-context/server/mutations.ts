import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  documents,
  people,
  spaceContextAgentMemories,
  spaceContextSectionMessages,
  spaceContextSections,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import { getOrgMemoryBySpaceSlug } from '../../governance/server/get-org-memory-by-space-slug';
import {
  SPACE_CONTEXT_SPECIALISTS,
  type SpaceContextSectionKey,
  type SpaceContextStatus,
} from '../constants';
import type {
  SpaceContextMessageRecord,
  SpaceContextOverview,
  SpaceContextSectionRecord,
} from '../types';
import { listSpaceContextSections } from './queries';
import { mapSectionRow } from './map-row';
import { firstMarkdownParagraph } from '../markdown';

async function requireSpaceId(spaceSlug: string, db: DbConfig['db']) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;
  return space;
}

export async function patchSpaceContextSection(
  {
    spaceSlug,
    sectionKey,
    markdown,
    status,
    personId,
  }: {
    spaceSlug: string;
    sectionKey: SpaceContextSectionKey;
    markdown?: string;
    status?: SpaceContextStatus;
    personId?: number | null;
  },
  { db }: DbConfig,
): Promise<SpaceContextSectionRecord | null> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return null;

  await listSpaceContextSections({ spaceSlug }, { db });

  const [existing] = await db
    .select()
    .from(spaceContextSections)
    .where(
      and(
        eq(spaceContextSections.spaceId, space.id),
        eq(spaceContextSections.sectionKey, sectionKey),
      ),
    )
    .limit(1);
  if (!existing) return null;

  const nextMarkdown = markdown ?? existing.markdown;
  let nextStatus = status ?? existing.status;
  if (
    markdown != null &&
    markdown.trim() &&
    existing.status === 'not_started' &&
    status == null
  ) {
    nextStatus = 'draft';
  }
  if (markdown != null && !markdown.trim() && existing.status === 'draft') {
    nextStatus = 'not_started';
  }

  const [updated] = await db
    .update(spaceContextSections)
    .set({
      markdown: nextMarkdown,
      status: nextStatus,
      version: existing.version + (markdown != null ? 1 : 0),
      updatedByPersonId: personId ?? existing.updatedByPersonId,
      updatedAt: new Date(),
    })
    .where(eq(spaceContextSections.id, existing.id))
    .returning();

  if (!updated) return null;

  let lastEditorName: string | null = null;
  if (updated.updatedByPersonId != null) {
    try {
      const [editor] = await db
        .select({
          name: sql<
            string | null
          >`trim(concat_ws(' ', ${people.name}, ${people.surname}))`,
        })
        .from(people)
        .where(eq(people.id, updated.updatedByPersonId))
        .limit(1);
      lastEditorName = editor?.name?.trim() || null;
    } catch {
      lastEditorName = null;
    }
  }

  return mapSectionRow(updated, { lastEditorName });
}

export async function appendSpaceContextMessage(
  {
    spaceSlug,
    sectionKey,
    role,
    content,
    personId,
    agentKey,
  }: {
    spaceSlug: string;
    sectionKey: SpaceContextSectionKey;
    role: 'user' | 'assistant' | 'system';
    content: string;
    personId?: number | null;
    agentKey?: string | null;
  },
  { db }: DbConfig,
): Promise<SpaceContextMessageRecord | null> {
  const overview = await listSpaceContextSections({ spaceSlug }, { db });
  const section = overview?.sections.find(
    (item) => item.sectionKey === sectionKey,
  );
  if (!section) return null;

  const [row] = await db
    .insert(spaceContextSectionMessages)
    .values({
      sectionId: section.id,
      role,
      content,
      personId: personId ?? null,
      agentKey: agentKey ?? null,
    })
    .returning();
  if (!row) return null;

  return {
    id: row.id,
    sectionId: row.sectionId,
    personId: row.personId,
    personName: null,
    agentKey: row.agentKey,
    role,
    content: row.content,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),
  };
}

export async function saveSpaceContextAgentMemory(
  {
    spaceSlug,
    sectionKey,
    memoryMarkdown,
  }: {
    spaceSlug: string;
    sectionKey: SpaceContextSectionKey;
    memoryMarkdown: string;
  },
  { db }: DbConfig,
): Promise<boolean> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return false;
  const agentKey = SPACE_CONTEXT_SPECIALISTS[sectionKey].agentKey;

  await db
    .insert(spaceContextAgentMemories)
    .values({
      spaceId: space.id,
      sectionKey,
      agentKey,
      memoryMarkdown,
    })
    .onConflictDoUpdate({
      target: [
        spaceContextAgentMemories.spaceId,
        spaceContextAgentMemories.sectionKey,
        spaceContextAgentMemories.agentKey,
      ],
      set: {
        memoryMarkdown,
        updatedAt: new Date(),
      },
    });
  return true;
}

export async function markSpaceContextSectionsProposed(
  {
    spaceSlug,
    sectionKeys,
    documentId,
    personId,
  }: {
    spaceSlug: string;
    sectionKeys: SpaceContextSectionKey[];
    documentId: number;
    personId?: number | null;
  },
  { db }: DbConfig,
): Promise<SpaceContextSectionRecord[]> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return [];

  const [document] = await db
    .select({ id: documents.id, spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!document || document.spaceId !== space.id) return [];

  const updated = await db
    .update(spaceContextSections)
    .set({
      status: 'proposed',
      proposalDocumentId: documentId,
      updatedByPersonId: personId ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(spaceContextSections.spaceId, space.id),
        inArray(spaceContextSections.sectionKey, sectionKeys),
      ),
    )
    .returning();

  return updated
    .map((row) => mapSectionRow(row))
    .filter((row): row is SpaceContextSectionRecord => row != null);
}

export async function ratifySpaceContextSectionsByDocumentId(
  {
    documentId,
    web3ProposalId,
  }: { documentId?: number; web3ProposalId?: number },
  { db }: DbConfig,
): Promise<number> {
  let ids: number[] = [];
  if (documentId != null) {
    const rows = await db
      .select({ id: spaceContextSections.id })
      .from(spaceContextSections)
      .where(eq(spaceContextSections.proposalDocumentId, documentId));
    ids = rows.map((row) => row.id);
  } else if (web3ProposalId != null) {
    const rows = await db
      .select({ id: spaceContextSections.id })
      .from(spaceContextSections)
      .innerJoin(
        documents,
        eq(documents.id, spaceContextSections.proposalDocumentId),
      )
      .where(eq(documents.web3ProposalId, web3ProposalId));
    ids = rows.map((row) => row.id);
  }
  if (ids.length === 0) return 0;

  const [document] = documentId
    ? await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1)
    : await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.web3ProposalId, web3ProposalId ?? -1))
        .limit(1);

  await db
    .update(spaceContextSections)
    .set({
      status: 'ratified',
      ratifiedDocumentId: document?.id ?? null,
      ratifiedAt: new Date(),
      proposalDocumentId: null,
      updatedAt: new Date(),
    })
    .where(inArray(spaceContextSections.id, ids));

  return ids.length;
}

export async function revertSpaceContextSectionsByDocumentId(
  { documentId }: { documentId: number },
  { db }: DbConfig,
): Promise<number> {
  const result = await db
    .update(spaceContextSections)
    .set({
      status: sql`case
        when trim(coalesce(${spaceContextSections.markdown}, '')) = '' then 'not_started'
        else 'draft'
      end`,
      proposalDocumentId: null,
      updatedAt: new Date(),
    })
    .where(eq(spaceContextSections.proposalDocumentId, documentId))
    .returning();
  return result.length;
}

export async function importSpaceContextFromMemory(
  {
    spaceSlug,
    personId,
    authToken,
    requestUrlForSessionMatrix,
  }: {
    spaceSlug: string;
    personId?: number | null;
    authToken?: string;
    requestUrlForSessionMatrix?: string;
  },
  { db }: DbConfig,
): Promise<SpaceContextOverview | null> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return null;

  await listSpaceContextSections({ spaceSlug }, { db });

  const description = (space.description ?? '').trim();
  const usableDescription =
    description && description !== 'SHOULD NOT BE EMPTY' ? description : '';

  let memoryExcerpt = '';
  try {
    const gated = await getOrgMemoryBySpaceSlug(
      {
        spaceSlug,
        page: 1,
        pageSize: 8,
        assetsPage: 1,
        assetsPageSize: 8,
        requestUrlForSessionMatrix,
      },
      { db, authToken },
    );
    if (gated.access === 'ok') {
      const titles = (gated.result.org_memory_assets ?? [])
        .slice(0, 5)
        .map((asset) => `- ${asset.filename}`)
        .join('\n');
      if (titles) {
        memoryExcerpt = `## From Space Memory\n\n${titles}`;
      }
    }
  } catch (error) {
    console.warn(
      '[importSpaceContextFromMemory] org memory read failed',
      error,
    );
  }

  const missionDraft = [usableDescription, memoryExcerpt]
    .filter(Boolean)
    .join('\n\n');

  if (missionDraft) {
    const [existing] = await db
      .select()
      .from(spaceContextSections)
      .where(
        and(
          eq(spaceContextSections.spaceId, space.id),
          eq(spaceContextSections.sectionKey, 'mission'),
        ),
      )
      .limit(1);
    if (existing && !existing.markdown.trim()) {
      await db
        .update(spaceContextSections)
        .set({
          markdown: missionDraft,
          status: 'draft',
          updatedByPersonId: personId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(spaceContextSections.id, existing.id));
    }
  }

  return listSpaceContextSections({ spaceSlug }, { db });
}

export function leadFromSectionMarkdown(markdown: string): string {
  return firstMarkdownParagraph(markdown);
}
