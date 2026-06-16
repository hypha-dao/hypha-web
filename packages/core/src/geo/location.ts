import { SPACE_LOCATION_SOURCES, type SpaceLocationSource } from './validation';

const SPACE_LOCATION_SOURCE_SET = new Set<string>(SPACE_LOCATION_SOURCES);

/** Reject the Gulf of Guinea null island unless explicitly allowed. */
export function isNullIsland(
  latitude: number,
  longitude: number,
  epsilon = 0.0001,
): boolean {
  return Math.abs(latitude) < epsilon && Math.abs(longitude) < epsilon;
}

export function normalizeGeocodeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export function mapNominatimResults(rows: NominatimSearchResult[]): Array<{
  label: string;
  latitude: number;
  longitude: number;
  placeId: string;
}> {
  return rows
    .map((row) => {
      const latitude = Number.parseFloat(row.lat);
      const longitude = Number.parseFloat(row.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return null;
      }
      if (isNullIsland(latitude, longitude)) {
        return null;
      }
      return {
        label: row.display_name,
        latitude,
        longitude,
        placeId: String(row.place_id),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function buildLocatedAtPatch(input: {
  latitude?: number | null;
  longitude?: number | null;
}): { locatedAt: Date | null } | Record<string, never> {
  if (input.latitude === undefined && input.longitude === undefined) {
    return {};
  }
  if (input.latitude === null && input.longitude === null) {
    return { locatedAt: null };
  }
  if (input.latitude != null && input.longitude != null) {
    return { locatedAt: new Date() };
  }
  return {};
}

export function isSpaceLocationSource(
  value: string | null | undefined,
): value is SpaceLocationSource {
  return typeof value === 'string' && SPACE_LOCATION_SOURCE_SET.has(value);
}
