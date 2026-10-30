import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  documents,
  people,
  spaceContextAgentMemories,
  spaceContextSections,
  type SpaceContextSection,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import { getOrgMemoryBySpaceSlug } from '../../governance/server/get-org-memory-by-space-slug';
import {
  SPACE_CONTEXT_CUSTOM_KEY_PREFIX,
  specialistForSectionKey,
  type SpaceContextSectionKey,
} from '../constants';
import type { SpaceContextOverview, SpaceContextSectionRecord } from '../types';
import { listSpaceContextSections } from './queries';
import { mapSectionRow } from './map-row';
import { firstMarkdownParagraph, normalizeSectionTitle } from '../markdown';

async function requireSpaceId(spaceSlug: string, db: DbConfig['db']) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;
  return space;
}

/** Why a Context write was refused; routes map it to an HTTP status. */
export type SpaceContextWriteError =
  | 'not_found'
  | 'on_voting'
  | 'removed'
  | 'invalid_title'
  | 'duplicate_title'
  | 'not_allowed';

export type SpaceContextWriteResult =
  | { ok: true; section: SpaceContextSectionRecord }
  | { ok: false; error: SpaceContextWriteError };

async function findSectionRow(
  spaceId: number,
  sectionKey: SpaceContextSectionKey,
  db: DbConfig['db'],
) {
  const [row] = await db
    .select()
    .from(spaceContextSections)
    .where(
      and(
        eq(spaceContextSections.spaceId, spaceId),
        eq(spaceContextSections.sectionKey, sectionKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function editorName(
  personId: number | null,
  db: DbConfig['db'],
): Promise<string | null> {
  if (personId == null) return null;
  try {
    const [editor] = await db
      .select({
        name: sql<
          string | null
        >`trim(concat_ws(' ', ${people.name}, ${people.surname}))`,
      })
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);
    return editor?.name?.trim() || null;
  } catch {
    return null;
  }
}

async function toWriteResult(
  row: SpaceContextSection | undefined,
  db: DbConfig['db'],
): Promise<SpaceContextWriteResult> {
  if (!row) return { ok: false, error: 'not_found' };
  const section = mapSectionRow(row, {
    lastEditorName: await editorName(row.updatedByPersonId, db),
  });
  return section ? { ok: true, section } : { ok: false, error: 'not_found' };
}

/**
 * Write the working draft. The ratified text is untouched: it only changes
 * when a proposal passes. Drafts cannot change while the section is on voting.
 */
export async function saveSpaceContextSectionDraft(
  {
    spaceSlug,
    sectionKey,
    markdown,
    personId,
  }: {
    spaceSlug: string;
    sectionKey: SpaceContextSectionKey;
    markdown: string;
    personId?: number | null;
  },
  { db }: DbConfig,
): Promise<SpaceContextWriteResult> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return { ok: false, error: 'not_found' };

  await listSpaceContextSections({ spaceSlug }, { db });

  const existing = await findSectionRow(space.id, sectionKey, db);
  if (!existing) return { ok: false, error: 'not_found' };
  if (existing.status === 'proposed') return { ok: false, error: 'on_voting' };
  if (existing.removedAt != null && existing.pendingChange !== 'add') {
    return { ok: false, error: 'removed' };
  }

  let nextStatus = existing.status;
  if (markdown.trim() && existing.status === 'not_started') {
    nextStatus = 'draft';
  }
  if (!markdown.trim() && existing.status === 'draft') {
    nextStatus = 'not_started';
  }

  const [updated] = await db
    .update(spaceContextSections)
    .set({
      markdown,
      status: nextStatus,
      version: existing.version + 1,
      updatedByPersonId: personId ?? existing.updatedByPersonId,
      updatedAt: new Date(),
    })
    .where(eq(spaceContextSections.id, existing.id))
    .returning();

  return toWriteResult(updated, db);
}

function newCustomSectionKey(): SpaceContextSectionKey {
  const id = globalThis.crypto
    .randomUUID()
    .replace(/-/g, '')
    .slice(0, 12)
    .toLowerCase();
  return `${SPACE_CONTEXT_CUSTOM_KEY_PREFIX}${id}`;
}

/**
 * Suggest a new section, or restoring one a passed proposal removed. The
 * suggestion is a draft; it joins the official Context when its proposal passes.
 */
export async function suggestSpaceContextSection(
  input:
    | {
        spaceSlug: string;
        title: string;
        markdown?: string;
        personId?: number | null;
      }
    | {
        spaceSlug: string;
        restoreSectionKey: SpaceContextSectionKey;
        personId?: number | null;
      },
  { db }: DbConfig,
): Promise<SpaceContextWriteResult> {
  const space = await requireSpaceId(input.spaceSlug, db);
  if (!space) return { ok: false, error: 'not_found' };
  const overview = await listSpaceContextSections(
    { spaceSlug: input.spaceSlug },
    { db },
  );
  if (!overview) return { ok: false, error: 'not_found' };

  if ('restoreSectionKey' in input) {
    const row = await findSectionRow(space.id, input.restoreSectionKey, db);
    if (!row) return { ok: false, error: 'not_found' };
    if (row.removedAt == null || row.pendingChange != null) {
      return { ok: false, error: 'not_allowed' };
    }
    const [updated] = await db
      .update(spaceContextSections)
      .set({
        pendingChange: 'add',
        status: row.markdown.trim() ? 'draft' : 'not_started',
        updatedByPersonId: input.personId ?? row.updatedByPersonId,
        updatedAt: new Date(),
      })
      .where(eq(spaceContextSections.id, row.id))
      .returning();
    return toWriteResult(updated, db);
  }

  const title = normalizeSectionTitle(input.title);
  if (!title) return { ok: false, error: 'invalid_title' };
  const taken = new Set(
    [
      ...overview.sections.map((section) => section.title),
      ...overview.removedSections.map((section) => section.title),
    ].map((value) => value.trim().toLowerCase()),
  );
  if (taken.has(title.toLowerCase())) {
    return { ok: false, error: 'duplicate_title' };
  }

  const markdown = input.markdown?.trim() ?? '';
  const [created] = await db
    .insert(spaceContextSections)
    .values({
      spaceId: space.id,
      sectionKey: newCustomSectionKey(),
      title,
      markdown,
      status: markdown ? 'draft' : 'not_started',
      pendingChange: 'add',
      updatedByPersonId: input.personId ?? null,
    })
    .returning();
  return toWriteResult(created, db);
}

/** Suggest removing a section from the official Context, or withdraw that suggestion. */
export async function setSpaceContextSectionRemovalSuggested(
  {
    spaceSlug,
    sectionKey,
    suggested,
    personId,
  }: {
    spaceSlug: string;
    sectionKey: SpaceContextSectionKey;
    suggested: boolean;
    personId?: number | null;
  },
  { db }: DbConfig,
): Promise<SpaceContextWriteResult> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return { ok: false, error: 'not_found' };
  const row = await findSectionRow(space.id, sectionKey, db);
  if (!row) return { ok: false, error: 'not_found' };
  if (row.status === 'proposed') return { ok: false, error: 'on_voting' };
  if (row.removedAt != null || row.pendingChange === 'add') {
    return { ok: false, error: 'not_allowed' };
  }
  const [updated] = await db
    .update(spaceContextSections)
    .set({
      pendingChange: suggested ? 'remove' : null,
      updatedByPersonId: personId ?? row.updatedByPersonId,
      updatedAt: new Date(),
    })
    .where(eq(spaceContextSections.id, row.id))
    .returning();
  return toWriteResult(updated, db);
}

/**
 * Withdraw a suggested addition. A new section that was never ratified is
 * deleted; a suggested restore leaves the section removed.
 */
export async function discardSpaceContextSectionSuggestion(
  {
    spaceSlug,
    sectionKey,
  }: { spaceSlug: string; sectionKey: SpaceContextSectionKey },
  { db }: DbConfig,
): Promise<{ ok: true } | { ok: false; error: SpaceContextWriteError }> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return { ok: false, error: 'not_found' };
  const row = await findSectionRow(space.id, sectionKey, db);
  if (!row) return { ok: false, error: 'not_found' };
  if (row.pendingChange !== 'add') return { ok: false, error: 'not_allowed' };
  if (row.status === 'proposed') return { ok: false, error: 'on_voting' };

  if (row.removedAt == null && row.ratifiedDocumentId == null) {
    await db
      .delete(spaceContextSections)
      .where(eq(spaceContextSections.id, row.id));
    return { ok: true };
  }
  await db
    .update(spaceContextSections)
    .set({ pendingChange: null, updatedAt: new Date() })
    .where(eq(spaceContextSections.id, row.id));
  return { ok: true };
}

/**
 * Keep the first discussion room stored for a section. When two members open
 * the section at once, the later room loses and both land in the stored one.
 */
export async function setSpaceContextSectionChatRoom(
  {
    spaceSlug,
    sectionKey,
    chatRoomId,
  }: {
    spaceSlug: string;
    sectionKey: SpaceContextSectionKey;
    chatRoomId: string;
  },
  { db }: DbConfig,
): Promise<string | null> {
  const space = await requireSpaceId(spaceSlug, db);
  if (!space) return null;

  await listSpaceContextSections({ spaceSlug }, { db });

  const sectionWhere = and(
    eq(spaceContextSections.spaceId, space.id),
    eq(spaceContextSections.sectionKey, sectionKey),
  );
  const [claimed] = await db
    .update(spaceContextSections)
    .set({ chatRoomId })
    .where(and(sectionWhere, isNull(spaceContextSections.chatRoomId)))
    .returning();
  if (claimed?.chatRoomId) return claimed.chatRoomId;

  const [existing] = await db
    .select({ chatRoomId: spaceContextSections.chatRoomId })
    .from(spaceContextSections)
    .where(sectionWhere)
    .limit(1);
  return existing?.chatRoomId ?? null;
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
  const agentKey = specialistForSectionKey(sectionKey).agentKey;

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

  const candidates = await db
    .select()
    .from(spaceContextSections)
    .where(
      and(
        eq(spaceContextSections.spaceId, space.id),
        inArray(spaceContextSections.sectionKey, sectionKeys),
      ),
    );
  const ids = candidates
    .filter(
      (row) =>
        (row.removedAt == null || row.pendingChange === 'add') &&
        (row.status !== 'proposed' || row.proposalDocumentId === documentId),
    )
    .map((row) => row.id);
  if (ids.length === 0) return [];

  const updated = await db
    .update(spaceContextSections)
    .set({
      status: 'proposed',
      proposalDocumentId: documentId,
      updatedByPersonId: personId ?? null,
      updatedAt: new Date(),
    })
    .where(inArray(spaceContextSections.id, ids))
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

  const changes = await db
    .select({
      id: spaceContextSections.id,
      pendingChange: spaceContextSections.pendingChange,
    })
    .from(spaceContextSections)
    .where(inArray(spaceContextSections.id, ids));
  const removalIds = changes
    .filter((row) => row.pendingChange === 'remove')
    .map((row) => row.id);
  const ratifyIds = changes
    .filter((row) => row.pendingChange !== 'remove')
    .map((row) => row.id);
  const now = new Date();

  if (ratifyIds.length > 0) {
    await db
      .update(spaceContextSections)
      .set({
        status: 'ratified',
        ratifiedDocumentId: document?.id ?? null,
        ratifiedAt: now,
        ratifiedMarkdown: sql`${spaceContextSections.markdown}`,
        proposalDocumentId: null,
        pendingChange: null,
        removedAt: null,
        updatedAt: now,
      })
      .where(inArray(spaceContextSections.id, ratifyIds));
  }

  if (removalIds.length > 0) {
    await db
      .update(spaceContextSections)
      .set({
        removedAt: now,
        pendingChange: null,
        status: sql`case
          when ${spaceContextSections.ratifiedDocumentId} is not null then 'ratified'
          when trim(coalesce(${spaceContextSections.markdown}, '')) = '' then 'not_started'
          else 'draft'
        end`,
        proposalDocumentId: null,
        updatedAt: now,
      })
      .where(inArray(spaceContextSections.id, removalIds));
  }

  return ids.length;
}

export async function revertSpaceContextSectionsByDocumentId(
  { documentId }: { documentId: number },
  { db }: DbConfig,
): Promise<number> {
  const result = await db
    .update(spaceContextSections)
    .set({
      markdown: sql`case
        when ${spaceContextSections.ratifiedDocumentId} is not null
          and ${spaceContextSections.ratifiedMarkdown} is not null
          then ${spaceContextSections.ratifiedMarkdown}
        else ${spaceContextSections.markdown}
      end`,
      status: sql`case
        when ${spaceContextSections.ratifiedDocumentId} is not null then 'ratified'
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
