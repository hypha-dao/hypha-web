import 'server-only';

import {
  mapNominatimResults,
  normalizeGeocodeQuery,
  prepareGeocodeQueries,
  type NominatimSearchResult,
} from '../location';
import type { GeocodeResult } from '../validation';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1_000;
const FETCH_TIMEOUT_MS = 5_000;

type CacheEntry = {
  expiresAt: number;
  results: GeocodeResult[];
};

const geocodeCache = new Map<string, CacheEntry>();

function pruneGeocodeCache(now: number): void {
  for (const [key, entry] of geocodeCache) {
    if (entry.expiresAt <= now) {
      geocodeCache.delete(key);
    }
  }
  while (geocodeCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = geocodeCache.keys().next().value;
    if (!oldestKey) break;
    geocodeCache.delete(oldestKey);
  }
}

function getNominatimUserAgent(): string {
  const fromEnv = process.env.NOMINATIM_USER_AGENT?.trim();
  if (fromEnv) return fromEnv;
  return 'HyphaPlatform/1.0 (https://hypha.earth; contact@hypha.earth)';
}

function dedupeGeocodeResults(results: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  const deduped: GeocodeResult[] = [];
  for (const result of results) {
    const key = `${result.placeId ?? result.label}:${result.latitude}:${
      result.longitude
    }`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

async function fetchNominatimOnce(
  query: string,
  limit: number,
): Promise<GeocodeResult[]> {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': getNominatimUserAgent(),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Nominatim request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return mapNominatimResults(payload as NominatimSearchResult[]);
}

export async function searchNominatim(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<GeocodeResult[]> {
  const now = Date.now();
  pruneGeocodeCache(now);
  const normalizedLimit = Number.isFinite(limit)
    ? Math.floor(limit)
    : DEFAULT_LIMIT;
  const safeLimit = Math.max(1, Math.min(normalizedLimit, MAX_LIMIT));
  const queryVariants = prepareGeocodeQueries(query);
  if (queryVariants.length === 0) {
    return [];
  }

  const cacheKey = `${normalizeGeocodeQuery(queryVariants[0]!)}:${safeLimit}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  let mergedResults: GeocodeResult[] = [];
  for (const variant of queryVariants) {
    const batch = await fetchNominatimOnce(variant, safeLimit);
    mergedResults = dedupeGeocodeResults([...mergedResults, ...batch]);
    if (mergedResults.length > 0) {
      break;
    }
  }

  const results = mergedResults.slice(0, safeLimit);

  geocodeCache.set(cacheKey, {
    results,
    expiresAt: now + CACHE_TTL_MS,
  });

  return results;
}

/** @internal test helper */
export function clearGeocodeCacheForTests(): void {
  geocodeCache.clear();
}
