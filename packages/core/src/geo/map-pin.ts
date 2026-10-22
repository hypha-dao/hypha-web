import { hasSpaceMapLocation, isNullIsland } from './location';

export type MapPinSource = 'space' | 'creator';

export type MapPinCoordinates = {
  latitude: number;
  longitude: number;
  source: MapPinSource;
};

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
 * Pin order: the space's own coordinates, then a geocoded creator location.
 * Spaces with neither stay off the map — no random or hashed placeholders.
 */
export function resolveSpaceMapPin(input: {
  spaceId: number;
  latitude?: number | null;
  longitude?: number | null;
  creatorCoordinates?: { latitude: number; longitude: number } | null;
}): MapPinCoordinates | null {
  const own = usableCoordinates(input);
  if (own) {
    return { ...own, source: 'space' };
  }

  const creator = usableCoordinates(input.creatorCoordinates ?? null);
  if (creator) {
    return { ...creator, source: 'creator' };
  }

  return null;
}
