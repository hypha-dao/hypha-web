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

export function collapseWhitespace(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).join(' ');
}

export function normalizeGeocodeQuery(query: string): string {
  return collapseWhitespace(query).toLowerCase();
}

const UNIT_KEYWORDS = [
  'apartment',
  'building',
  'suite',
  'floor',
  'unit',
  'apt',
  'bldg',
  'ste',
  'fl',
] as const;

function isTokenChar(char: string): boolean {
  return /[\w-]/i.test(char);
}

function skipSpaces(value: string, index: number): number {
  while (index < value.length && value[index] === ' ') {
    index += 1;
  }
  return index;
}

function readTokenEnd(value: string, index: number): number {
  let end = index;
  while (end < value.length && isTokenChar(value[end]!)) {
    end += 1;
  }
  return end;
}

/** Remove unit/suite/apartment suffixes without regex backtracking. */
function stripUnitSuffixFromSegment(segment: string): string {
  let result = collapseWhitespace(segment);

  const hashIndex = result.indexOf('#');
  if (hashIndex !== -1) {
    const afterHash = skipSpaces(result, hashIndex + 1);
    const tokenEnd = readTokenEnd(result, afterHash);
    if (tokenEnd > afterHash) {
      result = collapseWhitespace(result.slice(0, hashIndex));
    }
  }

  const lower = result.toLowerCase();
  for (const keyword of UNIT_KEYWORDS) {
    for (const delimiter of ['-', ' ', '–', '—']) {
      const needle = `${delimiter}${keyword}`;
      const index = lower.lastIndexOf(needle);
      if (index === -1) {
        continue;
      }

      const afterKeyword = skipSpaces(result, index + needle.length);
      const tokenEnd = readTokenEnd(result, afterKeyword);
      if (tokenEnd > afterKeyword) {
        result = collapseWhitespace(result.slice(0, index));
        return stripUnitSuffixFromSegment(result);
      }
    }
  }

  return result;
}

export function stripAddressUnitSuffixes(value: string): string {
  return collapseWhitespace(
    value
      .split(',')
      .map((part) => stripUnitSuffixFromSegment(part))
      .join(', '),
  );
}

function stripPostalCodes(value: string): string {
  const parts = collapseWhitespace(value).split(' ');
  const kept = parts.filter((part) => !/^\d{4,6}[A-Z]{0,2}$/i.test(part));
  return kept.join(' ');
}

/** Strip unit/suite tokens that often prevent Nominatim matches. */
export function simplifyGeocodeQuery(query: string): string {
  return stripAddressUnitSuffixes(query);
}

/** Ordered query variants — most specific first, then relaxed forms. */
export function prepareGeocodeQueries(query: string): string[] {
  const trimmed = collapseWhitespace(query);
  if (trimmed.length < 2) {
    return [];
  }

  const variants: string[] = [];
  const push = (value: string) => {
    const normalized = collapseWhitespace(value);
    if (normalized.length >= 2 && !variants.includes(normalized)) {
      variants.push(normalized);
    }
  };

  push(trimmed);

  const simplified = simplifyGeocodeQuery(trimmed);
  push(simplified);

  const withoutPostal = stripPostalCodes(simplified);
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
