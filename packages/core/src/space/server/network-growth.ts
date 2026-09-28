import { and, eq, isNull, or, sql } from 'drizzle-orm';
import {
  documents,
  memberships,
  spaces,
  tokens,
} from '@hypha-platform/storage-postgres';
import { HIDDEN_TOKEN_ADDRESSES } from '../../common/web3/tokens';
import type { DbConfig } from '../../common/server/types';
import {
  buildCumulativeSeries,
  countInMonth,
  type MonthlyCount,
  type NetworkGrowth,
} from '../network-growth';

/**
 * Spaces the network page already keeps: not the archived column, and not
 * the archived flag. Sandbox spaces stay, matching `getAllSpaces` on this
 * page (`omitArchived`, not `omitSandbox`).
 */
const countedSpace = sql`(
  ${spaces.isArchived} = false
  AND NOT (COALESCE(${spaces.flags}, '[]'::jsonb) @> '["archived"]'::jsonb)
)`;

function asCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asMonthly(rows: unknown): MonthlyCount[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (row == null || typeof row !== 'object') return [];
    const record = row as { month?: unknown; count?: unknown };
    const month = typeof record.month === 'string' ? record.month : '';
    if (!/^\d{4}-\d{2}$/.test(month)) return [];
    return [{ month, count: asCount(record.count) }];
  });
}

export async function getNetworkGrowth(
  { db }: DbConfig,
  now = new Date(),
): Promise<NetworkGrowth> {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const hiddenAddresses = [...HIDDEN_TOKEN_ADDRESSES];
  const notHidden =
    hiddenAddresses.length === 0
      ? undefined
      : sql`(
          ${tokens.address} IS NULL
          OR lower(${tokens.address}) NOT IN (${sql.join(
          hiddenAddresses.map((address) => sql`${address}`),
          sql`, `,
        )})
        )`;

  const [memberResult, agreementResult, tokenRows] = await Promise.all([
    db.execute(sql`
        WITH first_join AS (
          SELECT ${memberships.personId} AS person_id,
                 min(${memberships.createdAt}) AS first_at
          FROM ${memberships}
          INNER JOIN ${spaces} ON ${spaces.id} = ${memberships.spaceId}
          WHERE ${countedSpace}
          GROUP BY ${memberships.personId}
        )
        SELECT to_char(date_trunc('month', first_at), 'YYYY-MM') AS month,
               count(*)::int AS count
        FROM first_join
        GROUP BY 1
        ORDER BY 1
      `),
    db.execute(sql`
        SELECT to_char(date_trunc('month', ${documents.createdAt}), 'YYYY-MM') AS month,
               count(*)::int AS count
        FROM ${documents}
        INNER JOIN ${spaces} ON ${spaces.id} = ${documents.spaceId}
        WHERE ${documents.state} = 'agreement'
          AND ${countedSpace}
        GROUP BY 1
        ORDER BY 1
      `),
    db
      .select({
        total: sql<number>`count(*)::int`,
        thisMonth: sql<number>`count(*) filter (where ${tokens.createdAt} >= ${monthStart})::int`,
      })
      .from(tokens)
      .leftJoin(spaces, eq(tokens.spaceId, spaces.id))
      .where(
        and(
          eq(tokens.archived, false),
          or(isNull(tokens.spaceId), countedSpace),
          notHidden,
        ),
      ),
  ]);

  const memberMonths = asMonthly(memberResult.rows);
  const agreementMonths = asMonthly(agreementResult.rows);

  return {
    tokens: {
      total: asCount(tokenRows[0]?.total),
      thisMonth: asCount(tokenRows[0]?.thisMonth),
    },
    membersThisMonth: countInMonth(memberMonths, now),
    agreementsThisMonth: countInMonth(agreementMonths, now),
    members: buildCumulativeSeries(memberMonths, now),
    agreements: buildCumulativeSeries(agreementMonths, now),
  };
}
