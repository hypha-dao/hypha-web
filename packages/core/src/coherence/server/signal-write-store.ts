import 'server-only';

import { and, desc, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { coherences, spaces } from '@hypha-platform/storage-postgres';

import type { DbConfig } from '../../server';
import type { CoherenceSignalType } from '../coherence-types';
import {
  normalizeSignalWorkflowConfig,
  resolveDefaultBoard,
  resolveDefaultProgressStatus,
} from '../signal-workflow';
import {
  originToColumns,
  originViewFromColumns,
  type Origin,
  type OriginView,
} from '../../origin';

/**
 * The data layer of signal creation for AI clients (#2744): its own insert, not the app's
 * `createCoherence`. It writes what a signal is (space, creator, type, title, description, tags)
 * plus the origin, and nothing a caller chooses beyond that.
 *
 * Legacy task fields are still set to the same defaults the app uses (default status and board
 * from the space's workflow, the creator as assignee), so the signal shows in every view exactly
 * like one created in the app without those choices. They are compatibility, not part of what a
 * signal is, and the space's workflow config is only read here, never written.
 */

/** Two-key advisory lock namespace for signal creation (the issue number, like `2515`). */
const SIGNAL_CREATE_LOCK_NAMESPACE = 2744;

export type NewSignal = {
  spaceId: number;
  creatorId: number;
  type: CoherenceSignalType;
  title: string;
  description: string;
  tags: string[];
};

export type StoredSignal = {
  id: number;
  slug: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: Date;
  origin: OriginView;
};

export type DuplicateRule = {
  /** Serialises identical writes; equal for writes that would be duplicates. */
  fingerprint: string;
  /**
   * Rows created in the last `windowSeconds` are candidates. Measured by the database clock, the
   * same clock that set `created_at`, so app and database clocks cannot disagree.
   */
  windowSeconds: number;
  /** True when an existing row has the same content as the new one. */
  sameContent: (row: { title: string; description: string }) => boolean;
};

const returned = {
  id: coherences.id,
  slug: coherences.slug,
  type: coherences.type,
  title: coherences.title,
  description: coherences.description,
  tags: coherences.tags,
  createdAt: coherences.createdAt,
  originKind: coherences.originKind,
  originClientLabel: coherences.originClientLabel,
};

type ReturnedRow = {
  id: number;
  slug: string | null;
  type: string;
  title: string;
  description: string;
  tags: string[] | null;
  createdAt: Date;
  originKind: string;
  originClientLabel: string | null;
};

/** Only the listed fields leave the store; the client id stays in the database. */
function toStored(row: ReturnedRow): StoredSignal {
  return {
    id: row.id,
    slug: row.slug ?? '',
    type: row.type,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    createdAt: row.createdAt,
    origin: originViewFromColumns({
      originKind: row.originKind,
      originClientLabel: row.originClientLabel,
    }),
  };
}

/**
 * Create the signal, unless the same person already created the same content in the same space
 * through the same client within the duplicate window: then return that one with
 * `duplicate: true`. Identical writes that arrive together are serialised by a transaction-scoped
 * advisory lock on the fingerprint, so the second one finds the first one's row.
 */
export async function createSignalUnlessDuplicate(
  signal: NewSignal,
  duplicate: DuplicateRule,
  { db, origin }: DbConfig & { origin: Origin },
): Promise<{ signal: StoredSignal; duplicate: boolean }> {
  // Validate the origin first: the server sets it from the path, never from the input.
  const originColumnValues = originToColumns(origin);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${SIGNAL_CREATE_LOCK_NAMESPACE}, hashtext(${duplicate.fingerprint}))`,
    );

    const recent = await tx
      .select(returned)
      .from(coherences)
      .where(
        and(
          eq(coherences.spaceId, signal.spaceId),
          eq(coherences.creatorId, signal.creatorId),
          eq(coherences.originKind, originColumnValues.originKind),
          originColumnValues.originClientId === null
            ? sql`${coherences.originClientId} is null`
            : eq(coherences.originClientId, originColumnValues.originClientId),
          sql`${coherences.createdAt} >= now() - make_interval(secs => ${duplicate.windowSeconds})`,
        ),
      )
      // No row cap: the rate limit and the window keep the candidates few, and a cap could hide
      // an older match that is still inside the window.
      .orderBy(desc(coherences.createdAt));
    const existing = recent.find((row) => duplicate.sameContent(row));
    if (existing) return { signal: toStored(existing), duplicate: true };

    const [space] = await tx
      .select({ signalWorkflow: spaces.signalWorkflow })
      .from(spaces)
      .where(eq(spaces.id, signal.spaceId))
      .limit(1);
    if (!space) throw new Error('Space not found for the new signal');
    const workflow = normalizeSignalWorkflowConfig(space.signalWorkflow);

    // Values are listed one by one: nothing a caller adds to the input reaches the insert.
    const [row] = await tx
      .insert(coherences)
      .values({
        creatorId: signal.creatorId,
        spaceId: signal.spaceId,
        slug: `coh-${uuidv4().slice(0, 8)}`,
        type: signal.type,
        title: signal.title,
        description: signal.description,
        tags: signal.tags,
        archived: false,
        // Legacy task fields, app defaults (see the file comment).
        progressStatus: resolveDefaultProgressStatus(workflow),
        board: resolveDefaultBoard(workflow),
        assigneeIds: [signal.creatorId],
        ...originColumnValues,
      })
      .returning();
    if (!row) throw new Error('The new signal was not stored');
    return { signal: toStored(row), duplicate: false };
  });
}
