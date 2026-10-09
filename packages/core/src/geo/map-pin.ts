import { hasSpaceMapLocation, isNullIsland, roundCoordinate } from './location';

export type MapPinSource = 'space' | 'creator' | 'fallback';

export type MapPinCoordinates = {
  latitude: number;
  longitude: number;
  source: MapPinSource;
};

/**
 * Inhabited band of the world map. The globe does not sample land polygons
 * when placing a pin, so fallback pins spread across these bounds.
 */
const FALLBACK_LATITUDE_MIN = -55;
const FALLBACK_LATITUDE_MAX = 70;

function mix32(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function unitInterval(spaceId: number, salt: number): number {
  return mix32(Math.imul(spaceId, 0x9e3779b1) ^ salt) / 4294967296;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Stable map position for a space that has no saved coordinates and no
 * geocodable creator location. The same space id always yields the same
 * point. These coordinates are a pin only — never written onto the space.
 */
export function deterministicMapPin(spaceId: number): {
  latitude: number;
  longitude: number;
} {
  const id = Number.isInteger(spaceId) && spaceId > 0 ? spaceId : 1;
  let latitude = roundCoordinate(
    FALLBACK_LATITUDE_MIN +
      unitInterval(id, 0x85ebca6b) *
        (FALLBACK_LATITUDE_MAX - FALLBACK_LATITUDE_MIN),
  );
  let longitude = roundCoordinate(-180 + unitInterval(id, 0xc2b2ae35) * 360);

  latitude = clamp(latitude, FALLBACK_LATITUDE_MIN, FALLBACK_LATITUDE_MAX);
  longitude = clamp(longitude, -180, 180);
  if (longitude === 180) {
    longitude = -180;
  }
  if (isNullIsland(latitude, longitude)) {
    longitude = longitude >= 0 ? 1 : -1;
  }

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
