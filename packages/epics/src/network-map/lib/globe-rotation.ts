import type { Rotation } from './versor';

/** Default map focus when the viewer has no profile location. */
export const DEFAULT_MAP_CENTER = {
  latitude: 48.8566,
  longitude: 2.3522,
} as const;

/** D3 orthographic rotate angles that center the given point on the globe. */
export function globeRotationForCenter(
  longitude: number,
  latitude: number,
): Rotation {
  return [-longitude, -latitude, 0];
}

export const DEFAULT_GLOBE_ROTATION = globeRotationForCenter(
  DEFAULT_MAP_CENTER.longitude,
  DEFAULT_MAP_CENTER.latitude,
);
