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

function rowField(row: object, names: string[]): unknown {
  const record = row as Record<string, unknown>;
  for (const name of names) {
    if (record[name] != null) return record[name];
  }
  const lowered = new Map(
    Object.entries(record).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const name of names) {
    const value = lowered.get(name.toLowerCase());
    if (value != null) return value;
  }
  return undefined;
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
  const spaceRows = await findAllSpaces({ db }, props);

  // Counts are optional. A failure here must not wipe the directory — the
  // page treats an empty list as "no spaces", which is what the census and
  // map were showing.
  let memberResult: unknown = [];
  let agreementResult: unknown = [];
  try {
    [memberResult, agreementResult] = await Promise.all([
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
  } catch (error) {
    console.error('[getNetworkDirectorySpaces] Failed to load counts', error);
  }

  const peopleBySpace = new Map<number, number[]>();
  for (const row of rowsOf(memberResult)) {
    if (!row || typeof row !== 'object') continue;
    const spaceId = Number(rowField(row, ['space_id', 'spaceId']));
    if (!Number.isInteger(spaceId)) continue;
    peopleBySpace.set(
      spaceId,
      asIdList(rowField(row, ['person_ids', 'personIds'])),
    );
  }

  const agreementsBySpace = new Map<number, number>();
  for (const row of rowsOf(agreementResult)) {
    if (!row || typeof row !== 'object') continue;
    const spaceId = Number(rowField(row, ['space_id', 'spaceId']));
    if (!Number.isInteger(spaceId)) continue;
    agreementsBySpace.set(spaceId, asCount(rowField(row, ['count'])));
  }

  return spaceRows.map((space) => {
    const memberPersonIds = peopleBySpace.get(space.id);
    // `memberCount: 0` means archived on the client (`isSpaceArchived`).
    // A space with no membership rows is still a space — leave the count off
    // so it stays on the map and in the census.
    const hasMembers = memberPersonIds != null && memberPersonIds.length > 0;
    return {
      ...mapDbSpaceToSpace(space),
      ...(hasMembers
        ? { memberCount: memberPersonIds.length, memberPersonIds }
        : {}),
      documentCount: agreementsBySpace.get(space.id) ?? 0,
    };
  });
}
