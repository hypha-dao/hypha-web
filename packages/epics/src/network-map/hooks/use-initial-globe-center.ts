'use client';

import {
  geocodeResponseSchema,
  parseCoordinateInput,
  useMe,
} from '@hypha-platform/core/client';
import React from 'react';

import { DEFAULT_MAP_CENTER } from '../lib/globe-rotation';

export type GlobeMapCenter = {
  latitude: number;
  longitude: number;
  source: 'profile' | 'default';
};

function parseProfileLocationCoordinates(location: string): {
  latitude: number;
  longitude: number;
} | null {
  const parts = location.split(',').map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }

  const latitude = parseCoordinateInput(parts[0] ?? '');
  const longitude = parseCoordinateInput(parts[1] ?? '');
  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
}

export function useInitialGlobeCenter(): GlobeMapCenter {
  const { person, isLoading } = useMe();
  const [center, setCenter] = React.useState<GlobeMapCenter>({
    latitude: DEFAULT_MAP_CENTER.latitude,
    longitude: DEFAULT_MAP_CENTER.longitude,
    source: 'default',
  });

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    const location = person?.location?.trim();
    if (!location || location.length < 2) {
      setCenter({
        latitude: DEFAULT_MAP_CENTER.latitude,
        longitude: DEFAULT_MAP_CENTER.longitude,
        source: 'default',
      });
      return;
    }

    const parsedCoordinates = parseProfileLocationCoordinates(location);
    if (parsedCoordinates) {
      setCenter({
        latitude: parsedCoordinates.latitude,
        longitude: parsedCoordinates.longitude,
        source: 'profile',
      });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/v1/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: location, limit: 1 }),
        });
        if (!response.ok || cancelled) {
          return;
        }

        const payload = geocodeResponseSchema.safeParse(await response.json());
        const match = payload.success ? payload.data.data[0] : undefined;
        if (!match || cancelled) {
          return;
        }

        setCenter({
          latitude: match.latitude,
          longitude: match.longitude,
          source: 'profile',
        });
      } catch {
        // Keep Paris default when geocoding fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, person?.location]);

  return center;
}
