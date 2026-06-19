import type { SpaceLocationSource } from '@hypha-platform/core/client';

export function onboardingLocationFromCreatePayload(
  payload: Record<string, unknown>,
): {
  latitude?: number;
  longitude?: number;
  locationLabel?: string | null;
  locationSource?: SpaceLocationSource;
} {
  const latitude =
    typeof payload.latitude === 'number' ? payload.latitude : null;
  const longitude =
    typeof payload.longitude === 'number' ? payload.longitude : null;
  if (latitude == null || longitude == null) {
    return {};
  }

  const locationLabel =
    typeof payload.location_label === 'string' ? payload.location_label : null;
  const rawSource = payload.location_source;
  const locationSource: SpaceLocationSource =
    rawSource === 'geocode' ||
    rawSource === 'manual' ||
    rawSource === 'map_click'
      ? rawSource
      : 'geocode';

  return {
    latitude,
    longitude,
    locationLabel,
    locationSource,
  };
}
