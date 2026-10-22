import 'server-only';

import { people } from '@hypha-platform/storage-postgres';
import { and, inArray, isNull, notLike, or, sql } from 'drizzle-orm';

import type { DbConfig } from '../../server';
import { SPACE_ACTOR_SUB_PREFIX } from '../../people/server/space-actor-person';
import {
  hasSpaceMapLocation,
  isNullIsland,
  parseCoordinateInput,
} from '../location';
import type { GeocodeResult } from '../validation';
import { searchNominatim } from './nominatim';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const GEOCODE_CONCURRENCY = 4;
/**
 * Text places are looked up after the directory is already loaded. A few
 * seconds covers the creator places first, then member places. Longer than
 * this and the page waits on the geocoder instead of the map.
 */
const GEOCODE_BUDGET_MS = 8_000;

export type CreatorMapSpace = {
  id: number;
  latitude?: number | null;
  longitude?: number | null;
  creatorAddress?: string | null;
  /** On-chain members, used only when the space and its creator have no place. */
  memberAddresses?: readonly string[] | null;
};

export type FallbackLocationSource = 'creator' | 'member';

export type FallbackLocation = {
  spaceId: number;
  location: string;
  source: FallbackLocationSource;
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

function locationByAddressFrom(
  peopleRows: readonly CreatorPersonRow[],
): Map<string, string> {
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
  return locationByAddress;
}

function memberLocation(
  space: CreatorMapSpace,
  locationByAddress: ReadonlyMap<string, string>,
): string | null {
  const creator = normalizeCreatorAddress(space.creatorAddress);
  const addresses = [...(space.memberAddresses ?? [])]
    .map((address) => normalizeCreatorAddress(address))
    .filter(
      (address): address is string => address != null && address !== creator,
    )
    .sort();
  for (const address of addresses) {
    const location = locationByAddress.get(address);
    if (location) return location;
  }
  return null;
}

/**
 * One explainable place for each space that has no coordinates of its own.
 * The creator's profile wins. Otherwise the first other member, by wallet
 * address, who has a profile location. Space-actor rows are skipped.
 */
export function chooseFallbackLocations(
  spaces: readonly CreatorMapSpace[],
  peopleRows: readonly CreatorPersonRow[],
): FallbackLocation[] {
  const locationByAddress = locationByAddressFrom(peopleRows);
  const chosen: FallbackLocation[] = [];
  for (const space of spaces) {
    if (hasSpaceMapLocation(space)) {
      continue;
    }
    const creator = normalizeCreatorAddress(space.creatorAddress);
    const creatorLocation = creator
      ? locationByAddress.get(creator) ?? null
      : null;
    if (creatorLocation) {
      chosen.push({
        spaceId: space.id,
        location: creatorLocation,
        source: 'creator',
      });
      continue;
    }
    const fromMember = memberLocation(space, locationByAddress);
    if (fromMember) {
      chosen.push({
        spaceId: space.id,
        location: fromMember,
        source: 'member',
      });
    }
  }
  return chosen;
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
  return new Map(
    chooseFallbackLocations(spaces, peopleRows).map((row) => [
      row.spaceId,
      row.location,
    ]),
  );
}

/** Creator places first, then member places, so the short budget prefers creators. */
export function geocodeOrder(choices: readonly FallbackLocation[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const source of ['creator', 'member'] as const) {
    for (const choice of choices) {
      if (choice.source !== source || seen.has(choice.location)) continue;
      seen.add(choice.location);
      ordered.push(choice.location);
    }
  }
  return ordered;
}

/** A profile that already stores "latitude, longitude" needs no geocoder. */
export function coordinatesFromLocationText(
  location: string,
): { latitude: number; longitude: number } | null {
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const latitude = parseCoordinateInput(parts[0] ?? '');
  const longitude = parseCoordinateInput(parts[1] ?? '');
  if (latitude == null || longitude == null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (isNullIsland(latitude, longitude)) return null;
  return { latitude, longitude };
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

function addressesToResolve(spaces: readonly CreatorMapSpace[]): string[] {
  const wanted = new Set<string>();
  for (const space of spaces) {
    if (hasSpaceMapLocation(space)) continue;
    const creator = normalizeCreatorAddress(space.creatorAddress);
    if (creator) wanted.add(creator);
    for (const member of space.memberAddresses ?? []) {
      const address = normalizeCreatorAddress(member);
      if (address) wanted.add(address);
    }
  }
  return [...wanted];
}

/**
 * Geocode deployer, then member, locations for spaces that have no
 * coordinates of their own. The result is a pin lookup only. It does not
 * update space rows.
 */
export async function resolveCreatorMapCoordinates(
  spaces: readonly CreatorMapSpace[],
  { db }: DbConfig,
  geocode: (
    query: string,
    limit?: number,
  ) => Promise<GeocodeResult[]> = searchNominatim,
): Promise<Record<number, { latitude: number; longitude: number }>> {
  const wanted = addressesToResolve(spaces);
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

  const choices = chooseFallbackLocations(spaces, peopleRows);
  const coordinatesByLocation = new Map<
    string,
    { latitude: number; longitude: number }
  >();
  const uniqueLocations = geocodeOrder(choices).filter((location) => {
    const parsed = coordinatesFromLocationText(location);
    if (!parsed) return true;
    coordinatesByLocation.set(location, parsed);
    return false;
  });
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
  for (const choice of choices) {
    const coordinates = coordinatesByLocation.get(choice.location);
    if (coordinates) {
      pins[choice.spaceId] = coordinates;
    }
  }
  return pins;
}
