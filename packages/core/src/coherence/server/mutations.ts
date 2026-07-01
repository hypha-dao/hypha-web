import { v4 as uuidv4 } from 'uuid';

import { DatabaseInstance } from '../../server';
import {
  CreateCoherenceInput,
  PatchCoherenceTaskInput,
  UpdateCoherenceInput,
  UpdateCoherenceSignalInput,
} from '../types';
import { coherences, memberships } from '@hypha-platform/storage-postgres';
import { and, eq } from 'drizzle-orm';
import {
  assertValidBoard,
  assertValidProgressStatus,
  ensureSignalWorkflowConfig,
  updateSignalWorkflowConfig,
} from './signal-workflow';
import {
  DEFAULT_SIGNAL_PROGRESS_STATUS,
  normalizeAssigneeIds,
  resolveDefaultProgressStatus,
} from '../signal-workflow';

export async function assertCanEditCoherence(
  { slug, requesterPersonId }: { slug: string; requesterPersonId: number },
  { db }: { db: DatabaseInstance },
) {
  const existing = await db
    .select({
      id: coherences.id,
      creatorId: coherences.creatorId,
      spaceId: coherences.spaceId,
    })
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existing.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const row = existing[0]!;
  let canEdit = row.creatorId === requesterPersonId;
  if (!canEdit && row.spaceId != null) {
    const membership = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.spaceId, row.spaceId),
          eq(memberships.personId, requesterPersonId),
        ),
      )
      .limit(1);
    canEdit = membership.length > 0;
  }
  if (!canEdit) {
    throw new Error(
      'Only the signal creator or a space member can edit this coherence',
    );
  }
  return row;
}

export const createCoherence = async (
  {
    creatorId,
    spaceId,
    slug: maybeSlug,
    priority: maybePriority,
    progressStatus: inputProgressStatus,
    assigneeIds: inputAssigneeIds,
    board: inputBoard,
    dueAt: inputDueAt,
    ...rest
  }: CreateCoherenceInput,
  { db }: { db: DatabaseInstance },
) => {
  if (creatorId === undefined) {
    throw new Error('creatorId is required to create coherence');
  }
  if (spaceId === undefined) {
    throw new Error('spaceId is required to create coherence');
  }
  const slug = maybeSlug || `coh-${uuidv4().slice(0, 8)}`;
  const priority = maybePriority ?? 'medium';
  const assigneeIds = normalizeAssigneeIds(inputAssigneeIds ?? []);

  let progressStatus = inputProgressStatus;
  if (spaceId != null) {
    const workflow = await ensureSignalWorkflowConfig({ spaceId }, { db });
    progressStatus ??= resolveDefaultProgressStatus(workflow);
    assertValidProgressStatus(workflow, progressStatus);
    assertValidBoard(workflow, inputBoard ?? null);
  } else {
    progressStatus ??= DEFAULT_SIGNAL_PROGRESS_STATUS;
  }

  const [newSignal] = await db
    .insert(coherences)
    .values({
      creatorId,
      spaceId,
      slug,
      priority,
      progressStatus,
      assigneeIds,
      board: inputBoard ?? null,
      dueAt: inputDueAt ?? null,
      ...rest,
    })
    .returning();

  if (!newSignal) {
    throw new Error(
      `Failed to persist coherence for spaceId=${spaceId}, slug="${slug}"`,
    );
  }

  return newSignal;
};

export const updateCoherenceBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateCoherenceInput,
  { db }: { db: DatabaseInstance },
) => {
  const existing = await db
    .select({ id: coherences.id })
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existing.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const [updatedCoherence] = await db
    .update(coherences)
    .set({ ...rest })
    .where(eq(coherences.id, existing[0]!.id))
    .returning();

  if (!updatedCoherence) {
    throw new Error(`Failed to update coherence for slug="${slug}"`);
  }

  return updatedCoherence;
};

export const updateCoherenceSignalBySlug = async (
  {
    slug,
    requesterPersonId,
    ...rest
  }: { slug: string; requesterPersonId: number } & UpdateCoherenceSignalInput,
  { db }: { db: DatabaseInstance },
) => {
  const {
    type,
    priority,
    title,
    description,
    tags,
    dueAt,
    progressStatus,
    board,
    assigneeIds,
  } = rest;
  const row = await assertCanEditCoherence({ slug, requesterPersonId }, { db });

  if (row.spaceId != null) {
    const workflow = await ensureSignalWorkflowConfig(
      { spaceId: row.spaceId },
      { db },
    );
    assertValidProgressStatus(workflow, progressStatus ?? null);
    assertValidBoard(workflow, board ?? null);
  }

  const updated = await db
    .update(coherences)
    .set({
      type,
      priority,
      title,
      description,
      tags,
      dueAt: dueAt ?? null,
      progressStatus: progressStatus ?? DEFAULT_SIGNAL_PROGRESS_STATUS,
      board: board ?? null,
      assigneeIds: normalizeAssigneeIds(assigneeIds ?? []),
    })
    .where(eq(coherences.id, row.id))
    .returning();

  if (updated.length === 1) {
    return updated[0]!;
  }

  if (updated.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }

  throw new Error(`Failed to update coherence for slug="${slug}"`);
};

export const patchCoherenceTaskBySlug = async (
  {
    slug,
    requesterPersonId,
    ...rest
  }: { slug: string; requesterPersonId: number } & PatchCoherenceTaskInput,
  { db }: { db: DatabaseInstance },
) => {
  const row = await assertCanEditCoherence({ slug, requesterPersonId }, { db });
  const patch: Partial<typeof coherences.$inferInsert> = {};

  if (rest.dueAt !== undefined) {
    patch.dueAt = rest.dueAt;
  }
  if (rest.progressStatus !== undefined) {
    patch.progressStatus =
      rest.progressStatus ?? DEFAULT_SIGNAL_PROGRESS_STATUS;
  }
  if (rest.board !== undefined) {
    patch.board = rest.board;
  }
  if (rest.assigneeIds !== undefined) {
    patch.assigneeIds = normalizeAssigneeIds(rest.assigneeIds);
  }

  if (row.spaceId != null) {
    const workflow = await ensureSignalWorkflowConfig(
      { spaceId: row.spaceId },
      { db },
    );
    if (rest.progressStatus !== undefined) {
      assertValidProgressStatus(workflow, rest.progressStatus);
    }
    if (rest.board !== undefined) {
      assertValidBoard(workflow, rest.board);
    }
  }

  const updated = await db
    .update(coherences)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(coherences.id, row.id))
    .returning();

  if (updated.length === 1) {
    return updated[0]!;
  }

  throw new Error(`Failed to patch coherence task for slug="${slug}"`);
};

export const deleteCoherenceBySlug = async (
  { slug, requesterPersonId }: { slug: string; requesterPersonId: number },
  { db }: { db: DatabaseInstance },
) => {
  const existing = await db
    .select({
      id: coherences.id,
      creatorId: coherences.creatorId,
      spaceId: coherences.spaceId,
    })
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existing.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const row = existing[0]!;
  let canDelete = row.creatorId === requesterPersonId;
  if (!canDelete && row.spaceId != null) {
    const membership = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.spaceId, row.spaceId),
          eq(memberships.personId, requesterPersonId),
        ),
      )
      .limit(1);
    canDelete = membership.length > 0;
  }
  if (!canDelete) {
    throw new Error(
      'Only the signal creator or a space member can delete this coherence',
    );
  }
  const deleted = await db
    .delete(coherences)
    .where(eq(coherences.id, row.id))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error(`Failed to delete coherence for slug="${slug}"`);
  }

  return deleted[0];
};
