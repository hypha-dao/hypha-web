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
  resolveDefaultBoard,
  resolveDefaultProgressStatus,
} from '../signal-workflow';
import { mergeTagInList, normalizeTagKey } from '../signal-tags';
import {
  assigneeAcknowledgementMap,
  resetDeadlineNotifyState,
} from '../signal-notification-triggers';

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

/**
 * Load coherence row for mutations. Caller must enforce space auth.
 * `requesterPersonId: null` on the mutations below is a deliberate signal for a
 * trusted system path (e.g. ingestion), not "auth skipped" — see the comment
 * above `updateCoherenceSignalBySlug`.
 */
async function getCoherenceRowForTaskPatch(
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
) {
  const existing = await db
    .select({
      id: coherences.id,
      creatorId: coherences.creatorId,
      spaceId: coherences.spaceId,
      progressStatus: coherences.progressStatus,
      board: coherences.board,
      assigneeIds: coherences.assigneeIds,
      dueAt: coherences.dueAt,
      description: coherences.description,
      assigneeAcknowledgedAt: coherences.assigneeAcknowledgedAt,
      deadlineNotifyState: coherences.deadlineNotifyState,
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
  return existing[0]!;
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
  // Owner resolution: the explicit assignees, else the creator.
  // System-created signals have no creatorId and start unassigned.
  const assigneeIds = normalizeAssigneeIds(
    inputAssigneeIds?.length
      ? inputAssigneeIds
      : creatorId != null
      ? [creatorId]
      : [],
  );

  let progressStatus = inputProgressStatus;
  let defaultBoard: string | null = null;
  if (spaceId != null) {
    const workflow = await ensureSignalWorkflowConfig({ spaceId }, { db });
    progressStatus ??= resolveDefaultProgressStatus(workflow);
    assertValidProgressStatus(workflow, progressStatus);
    assertValidBoard(workflow, inputBoard ?? null);
    defaultBoard = resolveDefaultBoard(workflow);
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
      board: inputBoard ?? defaultBoard,
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

// `requesterPersonId` on this function and on `patchCoherenceTaskBySlug` /
// `deleteCoherenceBySlug` below is accepted and discarded, not enforced — this predates #2420
// (widened here from `number` to `number | null` only, to allow the ingestion route's
// `signal.creatorId`). It's safe because every real caller already runs
// `assertCoherenceSpacePanelAuth` (UI actions in `actions.ts`) or `authorizeIngestion` +
// `loadOwnedSignal` (the ingested-signal PATCH route) *before* reaching this function — so the
// permission check already happened one layer up by the time `requesterPersonId` arrives here.
// Tracked as pre-existing tech debt (dead/misleading param), not a live gap; out of scope for
// this ticket.
export const updateCoherenceSignalBySlug = async (
  {
    slug,
    requesterPersonId: _requesterPersonId,
    ...rest
  }: {
    slug: string;
    requesterPersonId: number | null;
  } & UpdateCoherenceSignalInput,
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
    archived,
  } = rest;
  const row = await getCoherenceRowForTaskPatch({ slug }, { db });
  const nextProgressStatus = progressStatus ?? DEFAULT_SIGNAL_PROGRESS_STATUS;
  const currentProgressStatus =
    row.progressStatus?.trim() || DEFAULT_SIGNAL_PROGRESS_STATUS;
  const nextBoard = board ?? null;
  const currentBoard = row.board?.trim() || null;
  const nextAssigneeIds =
    assigneeIds !== undefined
      ? normalizeAssigneeIds(assigneeIds)
      : normalizeAssigneeIds(row.assigneeIds);
  const nextDueAt = dueAt ?? null;

  if (row.spaceId != null) {
    const workflow = await ensureSignalWorkflowConfig(
      { spaceId: row.spaceId },
      { db },
    );
    if (nextProgressStatus !== currentProgressStatus) {
      assertValidProgressStatus(workflow, nextProgressStatus);
    }
    if (nextBoard !== currentBoard) {
      assertValidBoard(workflow, nextBoard);
    }
  }

  const updated = await db
    .update(coherences)
    .set({
      type,
      priority,
      title,
      description,
      tags,
      dueAt: nextDueAt,
      progressStatus: nextProgressStatus,
      board: nextBoard,
      assigneeIds: nextAssigneeIds,
      assigneeAcknowledgedAt: assigneeAcknowledgementMap(
        nextAssigneeIds,
        row.assigneeAcknowledgedAt,
      ),
      deadlineNotifyState: resetDeadlineNotifyState(
        nextDueAt,
        row.deadlineNotifyState,
      ),
      ...(archived !== undefined ? { archived } : {}),
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
    requesterPersonId: _requesterPersonId,
    ...rest
  }: {
    slug: string;
    requesterPersonId: number | null;
  } & PatchCoherenceTaskInput,
  { db }: { db: DatabaseInstance },
) => {
  const row = await getCoherenceRowForTaskPatch({ slug }, { db });
  const patch: Partial<typeof coherences.$inferInsert> = {};

  if (rest.dueAt !== undefined) {
    patch.dueAt = rest.dueAt;
    patch.deadlineNotifyState = resetDeadlineNotifyState(
      rest.dueAt,
      row.deadlineNotifyState,
    );
  }
  if (rest.progressStatus !== undefined) {
    patch.progressStatus =
      rest.progressStatus ?? DEFAULT_SIGNAL_PROGRESS_STATUS;
  }
  if (rest.board !== undefined) {
    patch.board = rest.board;
  }
  if (rest.assigneeIds !== undefined) {
    const nextAssigneeIds = normalizeAssigneeIds(rest.assigneeIds);
    patch.assigneeIds = nextAssigneeIds;
    patch.assigneeAcknowledgedAt = assigneeAcknowledgementMap(
      nextAssigneeIds,
      row.assigneeAcknowledgedAt,
    );
  }
  if (rest.priority !== undefined) {
    patch.priority = rest.priority;
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
      patch.board =
        rest.board == null || rest.board === ''
          ? resolveDefaultBoard(workflow)
          : rest.board;
      assertValidBoard(workflow, patch.board);
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
  {
    slug,
    requesterPersonId: _requesterPersonId,
  }: { slug: string; requesterPersonId: number | null },
  { db }: { db: DatabaseInstance },
) => {
  const row = await getCoherenceRowForTaskPatch({ slug }, { db });
  const deleted = await db
    .delete(coherences)
    .where(eq(coherences.id, row.id))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error(`Failed to delete coherence for slug="${slug}"`);
  }

  return deleted[0];
};

export const mergeCoherenceTags = async (
  {
    spaceId,
    fromTag,
    toTag,
  }: { spaceId: number; fromTag: string; toTag: string },
  { db }: { db: DatabaseInstance },
) => {
  const fromKey = normalizeTagKey(fromTag);
  const toKey = normalizeTagKey(toTag);
  if (!fromKey || !toKey) {
    throw new Error('Both tags are required to merge');
  }
  if (fromKey === toKey) {
    return { updated: 0 };
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: coherences.id, tags: coherences.tags })
      .from(coherences)
      .where(eq(coherences.spaceId, spaceId));

    let updated = 0;
    for (const row of rows) {
      const current = Array.isArray(row.tags) ? row.tags : [];
      const next = mergeTagInList(current, fromTag, toTag);
      const changed =
        next.length !== current.length ||
        next.some((tag, index) => tag !== current[index]);
      if (!changed) continue;
      await tx
        .update(coherences)
        .set({ tags: next, updatedAt: new Date() })
        .where(eq(coherences.id, row.id));
      updated += 1;
    }

    return { updated };
  });
};

export const acknowledgeCoherenceAssignment = async (
  { slug, personId }: { slug: string; personId: number },
  { db }: { db: DatabaseInstance },
) => {
  const row = await getCoherenceRowForTaskPatch({ slug }, { db });
  const assigneeIds = normalizeAssigneeIds(row.assigneeIds);
  if (!assigneeIds.includes(personId)) {
    return null;
  }
  const previous = row.assigneeAcknowledgedAt ?? {};
  if (previous[String(personId)]) {
    return null;
  }
  const next = {
    ...previous,
    [String(personId)]: new Date().toISOString(),
  };
  const [updated] = await db
    .update(coherences)
    .set({ assigneeAcknowledgedAt: next, updatedAt: new Date() })
    .where(eq(coherences.id, row.id))
    .returning();
  return updated ?? null;
};
