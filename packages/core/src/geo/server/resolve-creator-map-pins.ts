import 'server-only';

import { people } from '@hypha-platform/storage-postgres';
import { and, inArray, isNull, notLike, or, sql } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import { SPACE_ACTOR_SUB_PREFIX } from '../../people/server/space-actor-person';
import { hasSpaceMapLocation } from '../location';
import type { GeocodeResult } from '../validation';
import { searchNominatim } from './nominatim';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const GEOCODE_CONCURRENCY = 4;
/** Kept short so the network page can answer before the platform cuts it off. */
const GEOCODE_BUDGET_MS = 3_000;

export type CreatorMapSpace = {
  id: number;
  latitude?: number | null;
  longitude?: number | null;
  creatorAddress?: string | null;
};

export type CreatorPersonRow = {
  address: string | null;
  location: string | null;
  sub: string | null;
};

export function normalizeCreatorAddress(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim().toLowerCase() ?? '';
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
    return null;
  }
  if (trimmed === ZERO_ADDRESS) {
    return null;
  }
  return trimmed;
}

export function isSpaceActorSub(sub: string | null | undefined): boolean {
  return (
    typeof sub === 'string' &&
    sub.toLowerCase().startsWith(SPACE_ACTOR_SUB_PREFIX)
  );
}

/**
 * Location text to geocode for each space that has no coordinates of its own.
 * A creator is the on-chain deployer when that wallet belongs to a human
 * profile. Space-actor rows and people with no location are skipped.
 */
export function creatorLocationQueries(
  spaces: readonly CreatorMapSpace[],
  peopleRows: readonly CreatorPersonRow[],
): Map<number, string> {
  const locationByAddress = new Map<string, string>();
  for (const row of peopleRows) {
    if (isSpaceActorSub(row.sub)) {
      continue;
    }
    const address = normalizeCreatorAddress(row.address);
    const location = row.location?.trim() ?? '';
    if (!address || location.length < 2) {
      continue;
    }
    if (!locationByAddress.has(address)) {
      locationByAddress.set(address, location);
    }
  }

  const queries = new Map<number, string>();
  for (const space of spaces) {
    if (hasSpaceMapLocation(space)) {
      continue;
    }
    const address = normalizeCreatorAddress(space.creatorAddress);
    if (!address) {
      continue;
    }
    const location = locationByAddress.get(address);
    if (!location) {
      continue;
    }
    queries.set(space.id, location);
  }
  return queries;
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  deadlineAt: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<R | undefined>> {
  const results: Array<R | undefined> = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length && Date.now() < deadlineAt) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Geocode deployer locations for spaces that have no coordinates of their
 * own. The result is a pin lookup only. It does not update space rows.
 */
export async function resolveCreatorMapCoordinates(
  spaces: readonly CreatorMapSpace[],
  { db }: DbConfig,
  geocode: (
    query: string,
    limit?: number,
  ) => Promise<GeocodeResult[]> = searchNominatim,
): Promise<Record<number, { latitude: number; longitude: number }>> {
  const wanted = [
    ...new Set(
      spaces
        .filter((space) => !hasSpaceMapLocation(space))
        .map((space) => normalizeCreatorAddress(space.creatorAddress))
        .filter((address): address is string => address != null),
    ),
  ];
  if (wanted.length === 0) {
    return {};
  }

  const peopleRows = await db
    .select({
      address: people.address,
      location: people.location,
      sub: people.sub,
    })
    .from(people)
    .where(
      and(
        inArray(sql`upper(${people.address})`, [
          ...wanted.map((address) => address.toUpperCase()),
        ]),
        or(
          isNull(people.sub),
          notLike(people.sub, `${SPACE_ACTOR_SUB_PREFIX}%`),
        ),
      ),
    );

  const queries = creatorLocationQueries(spaces, peopleRows);
  const uniqueLocations = [...new Set(queries.values())];
  const coordinatesByLocation = new Map<
    string,
    { latitude: number; longitude: number }
  >();
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), GEOCODE_BUDGET_MS);
  const lookup =
    geocode === searchNominatim
      ? (query: string, limit?: number) =>
          searchNominatim(query, limit, controller.signal)
      : geocode;

  try {
    await mapPool(
      uniqueLocations,
      GEOCODE_CONCURRENCY,
      Date.now() + GEOCODE_BUDGET_MS,
      async (location) => {
        if (controller.signal.aborted) return;
        try {
          const [match] = await lookup(location, 1);
          if (!match) {
            return;
          }
          coordinatesByLocation.set(location, {
            latitude: match.latitude,
            longitude: match.longitude,
          });
        } catch (error) {
          console.error('[resolveCreatorMapCoordinates] geocode failed', {
            error,
          });
        }
      },
    );
  } finally {
    clearTimeout(budgetTimer);
  }

  const pins: Record<number, { latitude: number; longitude: number }> = {};
  for (const [spaceId, location] of queries) {
    const coordinates = coordinatesByLocation.get(location);
    if (coordinates) {
      pins[spaceId] = coordinates;
    }
  }
  return pins;
}
