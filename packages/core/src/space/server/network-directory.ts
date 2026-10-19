import { sql } from 'drizzle-orm';
import { documents, memberships } from '@hypha-platform/storage-postgres';

import type { DbConfig } from '../../common/server/types';
import type { Space } from '../types';
import { mapDbSpaceToSpace } from './map-db-space';
import { findAllSpaces } from './queries';

type FindAllSpacesProps = {
  search?: string;
  parentOnly?: boolean;
  omitSandbox?: boolean;
  omitArchived?: boolean;
};

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

function asIdList(value: unknown): number[] {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value
        .replace(/^\{|\}$/g, '')
        .split(',')
        .filter(Boolean)
    : [];
  return entries
    .map((entry) => Number(entry))
    .filter((id) => Number.isInteger(id));
}

function asCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Spaces for the network page from Postgres only.
 *
 * `getAllSpaces` also multicalls every space's on-chain member list. That
 * response is what made this page wait. Counts here come from memberships
 * and agreement documents.
 */
export async function getNetworkDirectorySpaces(
  { db }: DbConfig,
  props: FindAllSpacesProps = {},
): Promise<Space[]> {
  const [spaceRows, memberResult, agreementResult] = await Promise.all([
    findAllSpaces({ db }, props),
    db.execute(sql`
      select ${memberships.spaceId} as space_id,
             array_agg(${memberships.personId}) as person_ids
      from ${memberships}
      group by ${memberships.spaceId}
    `),
    db.execute(sql`
      select ${documents.spaceId} as space_id,
             count(*)::int as count
      from ${documents}
      where ${documents.state} = 'agreement'
      group by ${documents.spaceId}
    `),
  ]);

  const peopleBySpace = new Map<number, number[]>();
  for (const row of rowsOf(memberResult)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { space_id?: unknown; person_ids?: unknown };
    const spaceId = Number(record.space_id);
    if (!Number.isInteger(spaceId)) continue;
    peopleBySpace.set(spaceId, asIdList(record.person_ids));
  }

  const agreementsBySpace = new Map<number, number>();
  for (const row of rowsOf(agreementResult)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { space_id?: unknown; count?: unknown };
    const spaceId = Number(record.space_id);
    if (!Number.isInteger(spaceId)) continue;
    agreementsBySpace.set(spaceId, asCount(record.count));
  }

  return spaceRows.map((space) => {
    const memberPersonIds = peopleBySpace.get(space.id) ?? [];
    return {
      ...mapDbSpaceToSpace(space),
      memberCount: memberPersonIds.length,
      memberPersonIds,
      documentCount: agreementsBySpace.get(space.id) ?? 0,
    };
  });
}
