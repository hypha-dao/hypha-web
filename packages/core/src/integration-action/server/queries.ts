import {
  integrationActions,
  integrationClients,
} from '@hypha-platform/storage-postgres';
import { and, eq, gt, sql } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import type {
  IntegrationActionRecord,
  IntegrationActionWithClient,
} from '../types';

type ActionRow = typeof integrationActions.$inferSelect;

/** Built field by field so only intended columns leave the module. */
export function toActionRecord(row: ActionRow): IntegrationActionRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    personId: row.personId,
    operation: row.operation as IntegrationActionRecord['operation'],
    parameters: row.parameters as IntegrationActionRecord['parameters'],
    context: row.context as IntegrationActionRecord['context'],
    status: row.status,
    expiresAt: row.expiresAt,
    resolvedAt: row.resolvedAt,
    txHash: row.txHash,
    createdAt: row.createdAt,
  };
}

/**
 * The action, with the calling client's registered name, only when it belongs
 * to this person (the approval page lookup).
 */
export const findActionForPerson = async (
  { id, personId }: { id: string; personId: number },
  { db }: DbConfig,
): Promise<IntegrationActionWithClient | null> => {
  const [row] = await db
    .select({
      action: integrationActions,
      clientName: integrationClients.name,
    })
    .from(integrationActions)
    .innerJoin(
      integrationClients,
      eq(integrationClients.id, integrationActions.clientId),
    )
    .where(
      and(
        eq(integrationActions.id, id),
        eq(integrationActions.personId, personId),
      ),
    )
    .limit(1);
  return row
    ? { ...toActionRecord(row.action), clientName: row.clientName }
    : null;
};

/** The action only when it belongs to this client and person (the polling lookup). */
export const findActionForClientPerson = async (
  {
    id,
    clientId,
    personId,
  }: { id: string; clientId: number; personId: number },
  { db }: DbConfig,
): Promise<IntegrationActionRecord | null> => {
  const [row] = await db
    .select()
    .from(integrationActions)
    .where(
      and(
        eq(integrationActions.id, id),
        eq(integrationActions.clientId, clientId),
        eq(integrationActions.personId, personId),
      ),
    )
    .limit(1);
  return row ? toActionRecord(row) : null;
};

/** Open (not yet expired) pending actions one client holds for one person. */
export const countPendingActions = async (
  {
    clientId,
    personId,
    now,
  }: { clientId: number; personId: number; now: Date },
  { db }: DbConfig,
): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(integrationActions)
    .where(
      and(
        eq(integrationActions.clientId, clientId),
        eq(integrationActions.personId, personId),
        eq(integrationActions.status, 'pending'),
        gt(integrationActions.expiresAt, now),
      ),
    );
  return row?.count ?? 0;
};
