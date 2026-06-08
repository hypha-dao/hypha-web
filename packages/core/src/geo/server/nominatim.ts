import 'server-only';

import {
  mapNominatimResults,
  normalizeGeocodeQuery,
  type NominatimSearchResult,
} from '../location';
import type { GeocodeResult } from '../validation';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_LIMIT = 5;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  results: GeocodeResult[];
};

const geocodeCache = new Map<string, CacheEntry>();

function getNominatimUserAgent(): string {
  const fromEnv = process.env.NOMINATIM_USER_AGENT?.trim();
  if (fromEnv) return fromEnv;
  return 'HyphaPlatform/1.0 (https://hypha.earth; contact@hypha.earth)';
}

export async function searchNominatim(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<GeocodeResult[]> {
  const normalizedQuery = normalizeGeocodeQuery(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const cacheKey = `${normalizedQuery}:${limit}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': getNominatimUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }

  const payload = (await response.json()) as NominatimSearchResult[];
  const results = mapNominatimResults(payload);

  geocodeCache.set(cacheKey, {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return results;
}

/** @internal test helper */
export function clearGeocodeCacheForTests(): void {
  geocodeCache.clear();
}
