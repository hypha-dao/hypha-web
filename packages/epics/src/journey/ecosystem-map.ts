import * as d3 from 'd3';
import {
  WELLBEING_DIMENSIONS,
  type WellbeingDimension,
} from './wellbeing-model';

export const ECOSYSTEM_MAP_WIDTH = 1000;
export const ECOSYSTEM_MAP_HEIGHT = 520;
export const ECOSYSTEM_MAP_INSET: [[number, number], [number, number]] = [
  [18, 16],
  [982, 504],
];
export const ECOSYSTEM_MAP_SCALE_EXTENT: [number, number] = [1, 6];

const SPHERE: d3.GeoPermissibleObjects = { type: 'Sphere' };

export function createWorldProjection(
  land: d3.GeoPermissibleObjects | null,
): d3.GeoProjection {
  return d3
    .geoEquirectangular()
    .precision(0.2)
    .fitExtent(ECOSYSTEM_MAP_INSET, land ?? SPHERE);
}

export function projectLngLat(
  projection: d3.GeoProjection,
  latitude: number,
  longitude: number,
): { x: number; y: number } | null {
  const point = projection([longitude, latitude]);
  if (!point) return null;
  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export type SpaceMapPreviewMeta =
  | { kind: 'members'; count: number }
  | { kind: 'description'; text: string };

export function spaceMapPreviewMeta(space: {
  memberCount?: number | null;
  members?: readonly unknown[] | null;
  description?: string | null;
}): SpaceMapPreviewMeta | null {
  const count = space.memberCount ?? space.members?.length;
  if (count != null) {
    return { kind: 'members', count };
  }
  const text = space.description?.trim() ?? '';
  if (text) {
    return { kind: 'description', text };
  }
  return null;
}

export function dimensionForSpace(
  categories: readonly string[] | null | undefined,
  index: number,
): WellbeingDimension {
  const values = categories ?? [];
  if (values.some((c) => /health|well|inner|care/i.test(c))) return 'being';
  if (values.some((c) => /educat|research|tech/i.test(c))) return 'thinking';
  if (values.some((c) => /social|community|culture/i.test(c)))
    return 'relating';
  if (values.some((c) => /govern|network|dao/i.test(c))) return 'collaborating';
  if (values.some((c) => /energy|environment|food|econom/i.test(c))) {
    return 'acting';
  }
  return WELLBEING_DIMENSIONS[index % WELLBEING_DIMENSIONS.length] ?? 'acting';
}
