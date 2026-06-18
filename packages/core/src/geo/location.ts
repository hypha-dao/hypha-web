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

/** Strip unit/suite tokens that often prevent Nominatim matches. */
export function simplifyGeocodeQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, ' ')
    .replace(
      /\s*[-–—]\s*(unit|suite|apt|apartment|floor|fl|ste|bldg|building)\s*[\w-]+/gi,
      '',
    )
    .replace(
      /\s+(unit|suite|apt|apartment|floor|fl|ste|bldg|building)\s+[\w-]+/gi,
      '',
    )
    .replace(/\s+#\s*[\w-]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Ordered query variants — most specific first, then relaxed forms. */
export function prepareGeocodeQueries(query: string): string[] {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) {
    return [];
  }

  const variants: string[] = [];
  const push = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length >= 2 && !variants.includes(normalized)) {
      variants.push(normalized);
    }
  };

  push(trimmed);

  const simplified = simplifyGeocodeQuery(trimmed);
  push(simplified);

  const withoutPostal = simplified
    .replace(/\b\d{4,6}\s*[A-Z]{0,2}\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  push(withoutPostal);

  const commaParts = simplified
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (commaParts.length >= 2) {
    push(commaParts.slice(0, 2).join(', '));
    push(commaParts[0]!);
  }

  return variants;
}

export function parseCoordinateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function normalizeSpaceLocationFields(input: {
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string | null;
  locationSource?: SpaceLocationSource | null;
}): {
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationSource: SpaceLocationSource | null;
} {
  const rawLat =
    typeof input.latitude === 'string'
      ? parseCoordinateInput(input.latitude)
      : input.latitude;
  const rawLng =
    typeof input.longitude === 'string'
      ? parseCoordinateInput(input.longitude)
      : input.longitude;

  const hasLat = rawLat != null && Number.isFinite(rawLat);
  const hasLng = rawLng != null && Number.isFinite(rawLng);

  let latitude: number | null = hasLat ? roundCoordinate(rawLat!) : null;
  let longitude: number | null = hasLng ? roundCoordinate(rawLng!) : null;
  let locationLabel =
    typeof input.locationLabel === 'string'
      ? input.locationLabel.trim().slice(0, 500)
      : input.locationLabel ?? null;
  let locationSource = isSpaceLocationSource(input.locationSource)
    ? input.locationSource
    : null;

  if (locationLabel === '') {
    locationLabel = null;
  }

  if (hasLat !== hasLng) {
    latitude = null;
    longitude = null;
    locationSource = null;
  } else if (latitude != null && longitude != null) {
    if (isNullIsland(latitude, longitude)) {
      latitude = null;
      longitude = null;
      locationSource = null;
    }
  } else {
    locationSource = null;
  }

  return {
    latitude,
    longitude,
    locationLabel,
    locationSource,
  };
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

export function hasSpaceMapLocation(space: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  return (
    space.latitude != null &&
    space.longitude != null &&
    Number.isFinite(space.latitude) &&
    Number.isFinite(space.longitude)
  );
}
