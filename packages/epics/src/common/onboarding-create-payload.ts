import type { SpaceLocationSource } from '@hypha-platform/core/client';

function parseFiniteCoordinate(
  value: unknown,
  min: number,
  max: number,
): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

export function onboardingLocationFromCreatePayload(
  payload: Record<string, unknown>,
): {
  latitude?: number;
  longitude?: number;
  locationLabel?: string | null;
  locationSource?: SpaceLocationSource;
} {
  const latitude = parseFiniteCoordinate(payload.latitude, -90, 90);
  const longitude = parseFiniteCoordinate(payload.longitude, -180, 180);
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
