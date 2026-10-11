import { hasSpaceMapLocation, isNullIsland, roundCoordinate } from './location';

export type MapPinSource = 'space' | 'creator' | 'fallback';

export type MapPinCoordinates = {
  latitude: number;
  longitude: number;
  source: MapPinSource;
};

/**
 * Inland boxes on the continents. A uniform sample of the globe lands in
 * the ocean most of the time, so a space with no real place is pinned
 * inside one of these instead.
 */
const CONTINENTAL_LAND = [
  { latMin: 31, latMax: 49, lonMin: -114, lonMax: -90 },
  { latMin: 32, latMax: 45, lonMin: -90, lonMax: -78 },
  { latMin: 49, latMax: 60, lonMin: -120, lonMax: -97 },
  { latMin: 20, latMax: 30, lonMin: -106, lonMax: -98 },
  { latMin: -32, latMax: -12, lonMin: -64, lonMax: -48 },
  { latMin: -10, latMax: 2, lonMin: -70, lonMax: -52 },
  { latMin: 42, latMax: 54, lonMin: -4, lonMax: 18 },
  { latMin: 48, latMax: 60, lonMin: 12, lonMax: 30 },
  { latMin: -28, latMax: -12, lonMin: 18, lonMax: 30 },
  { latMin: -6, latMax: 12, lonMin: 14, lonMax: 32 },
  { latMin: 8, latMax: 28, lonMin: -5, lonMax: 24 },
  { latMin: 22, latMax: 40, lonMin: 73, lonMax: 88 },
  { latMin: 26, latMax: 42, lonMin: 102, lonMax: 120 },
  { latMin: 45, latMax: 58, lonMin: 62, lonMax: 90 },
  { latMin: -34, latMax: -22, lonMin: 124, lonMax: 145 },
] as const;

export function isContinentalLandPin(
  latitude: number,
  longitude: number,
): boolean {
  return CONTINENTAL_LAND.some(
    (box) =>
      latitude >= box.latMin &&
      latitude <= box.latMax &&
      longitude >= box.lonMin &&
      longitude <= box.lonMax,
  );
}

function mix32(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function unitInterval(spaceId: number, salt: number): number {
  return mix32(Math.imul(spaceId, 0x9e3779b1) ^ salt) / 4294967296;
}

/**
 * Stable map position for a space that has no saved coordinates and no
 * geocodable creator location. The same space id always yields the same
 * point, on continental land. These coordinates are a pin only — never
 * written onto the space.
 */
export function deterministicMapPin(spaceId: number): {
  latitude: number;
  longitude: number;
} {
  const id = Number.isInteger(spaceId) && spaceId > 0 ? spaceId : 1;
  const boxIndex = Math.min(
    CONTINENTAL_LAND.length - 1,
    Math.floor(unitInterval(id, 0x85ebca6b) * CONTINENTAL_LAND.length),
  );
  const box = CONTINENTAL_LAND[boxIndex] ?? CONTINENTAL_LAND[0];
  const latitude = roundCoordinate(
    box.latMin + unitInterval(id, 0xa5a5a5a5) * (box.latMax - box.latMin),
  );
  const longitude = roundCoordinate(
    box.lonMin + unitInterval(id, 0xc2b2ae35) * (box.lonMax - box.lonMin),
  );

  return { latitude, longitude };
}

function usableCoordinates(
  coordinates: { latitude?: number | null; longitude?: number | null } | null,
): { latitude: number; longitude: number } | null {
  if (!coordinates || !hasSpaceMapLocation(coordinates)) {
    return null;
  }
  if (isNullIsland(coordinates.latitude!, coordinates.longitude!)) {
    return null;
  }
  return {
    latitude: coordinates.latitude!,
    longitude: coordinates.longitude!,
  };
}

/**
 * Pin order: the space's own coordinates, then a geocoded creator location,
 * then a deterministic fallback. Does not mutate the space.
 */
export function resolveSpaceMapPin(input: {
  spaceId: number;
  latitude?: number | null;
  longitude?: number | null;
  creatorCoordinates?: { latitude: number; longitude: number } | null;
}): MapPinCoordinates {
  const own = usableCoordinates(input);
  if (own) {
    return { ...own, source: 'space' };
  }

  const creator = usableCoordinates(input.creatorCoordinates ?? null);
  if (creator) {
    return { ...creator, source: 'creator' };
  }

  return { ...deterministicMapPin(input.spaceId), source: 'fallback' };
}
