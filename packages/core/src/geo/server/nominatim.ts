import 'server-only';

import {
  mapNominatimResults,
  normalizeGeocodeQuery,
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

export async function searchNominatim(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<GeocodeResult[]> {
  const now = Date.now();
  pruneGeocodeCache(now);
  const safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
  const normalizedQuery = normalizeGeocodeQuery(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const cacheKey = `${normalizedQuery}:${safeLimit}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(safeLimit));
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

  const payload = (await response.json()) as NominatimSearchResult[];
  const results = mapNominatimResults(payload);

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
