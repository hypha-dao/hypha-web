import { integrationActions } from '@hypha-platform/storage-postgres';
import { and, eq, gt, sql } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import type {
  IntegrationActionRecord,
  VoteActionContext,
  VoteActionParameters,
} from '../types';
import { toActionRecord } from './queries';

export const createIntegrationAction = async (
  input: {
    clientId: number;
    personId: number;
    operation: IntegrationActionRecord['operation'];
    parameters: VoteActionParameters;
    context: VoteActionContext;
    expiresAt: Date;
  },
  { db }: DbConfig,
): Promise<IntegrationActionRecord> => {
  const [row] = await db.insert(integrationActions).values(input).returning();
  if (!row) throw new Error('Failed to persist integration action');
  return toActionRecord(row);
};

/**
 * `pending -> approved` or `pending -> rejected`, in one conditional update so
 * a second call (or a second tab) finds nothing to claim: single use. Returns
 * null when the action is not pending, expired, or not this person's.
 */
export const claimPendingAction = async (
  {
    id,
    personId,
    to,
    now,
  }: { id: string; personId: number; to: 'approved' | 'rejected'; now: Date },
  { db }: DbConfig,
): Promise<IntegrationActionRecord | null> => {
  const [row] = await db
    .update(integrationActions)
    .set({
      status: to,
      resolvedAt: to === 'rejected' ? now : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(integrationActions.id, id),
        eq(integrationActions.personId, personId),
        eq(integrationActions.status, 'pending'),
        gt(integrationActions.expiresAt, now),
      ),
    )
    .returning();
  return row ? toActionRecord(row) : null;
};

/** `approved -> submitted | failed`, once. Null when the action is not in `approved`. */
export const recordActionResult = async (
  {
    id,
    personId,
    result,
    now,
  }: {
    id: string;
    personId: number;
    result: { outcome: 'submitted'; txHash: string } | { outcome: 'failed' };
    now: Date;
  },
  { db }: DbConfig,
): Promise<IntegrationActionRecord | null> => {
  const [row] = await db
    .update(integrationActions)
    .set({
      status: result.outcome,
      txHash: result.outcome === 'submitted' ? result.txHash : null,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(integrationActions.id, id),
        eq(integrationActions.personId, personId),
        eq(integrationActions.status, 'approved'),
      ),
    )
    .returning();
  return row ? toActionRecord(row) : null;
};

/**
 * Preparing a new action for the same client, person and proposal replaces the
 * open ones: their expiry moves to `now`, so they read as `expired` and can no
 * longer be answered (a stale link cannot also vote). Returns how many closed.
 */
export const supersedePendingActions = async (
  {
    clientId,
    personId,
    spaceSlug,
    proposalSlug,
    now,
  }: {
    clientId: number;
    personId: number;
    spaceSlug: string;
    proposalSlug: string;
    now: Date;
  },
  { db }: DbConfig,
): Promise<number> => {
  const rows = await db
    .update(integrationActions)
    .set({ expiresAt: now, updatedAt: now })
    .where(
      and(
        eq(integrationActions.clientId, clientId),
        eq(integrationActions.personId, personId),
        eq(integrationActions.status, 'pending'),
        gt(integrationActions.expiresAt, now),
        sql`${integrationActions.parameters}->>'spaceSlug' = ${spaceSlug}`,
        sql`${integrationActions.parameters}->>'proposalSlug' = ${proposalSlug}`,
      ),
    )
    .returning({ id: integrationActions.id });
  return rows.length;
};
