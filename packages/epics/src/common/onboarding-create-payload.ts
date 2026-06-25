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

export function onboardingTransparencyFromCreatePayload(
  payload: Record<string, unknown>,
): {
  discoverability?: number;
  access?: number;
} {
  const discoverability =
    typeof payload.discoverability === 'number'
      ? payload.discoverability
      : undefined;
  const access =
    typeof payload.access === 'number' ? payload.access : undefined;
  if (discoverability === undefined && access === undefined) {
    return {};
  }
  return {
    ...(discoverability !== undefined &&
    discoverability >= 0 &&
    discoverability <= 3
      ? { discoverability }
      : {}),
    ...(access !== undefined && access >= 0 && access <= 3 ? { access } : {}),
  };
}

export function onboardingJoinMethodFromCreatePayload(
  payload: Record<string, unknown>,
): { joinMethod?: number } {
  const joinMethod =
    typeof payload.join_method === 'number' ? payload.join_method : undefined;
  if (joinMethod === undefined || joinMethod < 0 || joinMethod > 3) {
    return {};
  }
  return { joinMethod };
}
