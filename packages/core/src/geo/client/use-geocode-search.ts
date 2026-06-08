'use client';

import React from 'react';
import { geocodeResponseSchema, type GeocodeResult } from '../validation';

export type GeocodeSearchError = 'request_failed' | 'network_failed' | null;

type UseGeocodeSearchOptions = {
  debounceMs?: number;
};

export function useGeocodeSearch({
  debounceMs = 400,
}: UseGeocodeSearchOptions = {}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [error, setError] = React.useState<GeocodeSearchError>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const response = await fetch('/api/v1/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed, limit: 5 }),
          signal: controller.signal,
        });
        if (!response.ok) {
          setResults([]);
          setError('request_failed');
          return;
        }
        const payload = (await response.json()) as {
          results?: GeocodeResult[];
        };
        setResults(payload.results ?? []);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError('network_failed');
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [debounceMs, query]);

  const reset = React.useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsSearching(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    reset,
  };
}
