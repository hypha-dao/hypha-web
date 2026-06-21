import type { Space } from '@hypha-platform/core/client';

/** Precision for grouping collocated space pins (~1.1 m). */
const CLUSTER_COORD_PRECISION = 5;

export function clusterCoordinateKey(
  latitude: number,
  longitude: number,
): string {
  return `${latitude.toFixed(CLUSTER_COORD_PRECISION)},${longitude.toFixed(
    CLUSTER_COORD_PRECISION,
  )}`;
}

export type MapPinDatum =
  | {
      kind: 'space';
      pinKey: string;
      space: Space;
      dimmed?: boolean;
    }
  | {
      kind: 'cluster';
      pinKey: string;
      clusterId: string;
      spaces: Space[];
      latitude: number;
      longitude: number;
      count: number;
      dimmed?: boolean;
    }
  | {
      kind: 'spiderfy-space';
      pinKey: string;
      space: Space;
      clusterId: string;
      spiderfyIndex: number;
      spiderfyCount: number;
      latitude: number;
      longitude: number;
    };

export function buildMapPinData(
  spaces: Space[],
  focusedClusterId: string | null,
): MapPinDatum[] {
  const groups = new Map<string, Space[]>();

  for (const space of spaces) {
    const { latitude, longitude } = space;
    if (latitude == null || longitude == null) {
      continue;
    }
    const key = clusterCoordinateKey(latitude, longitude);
    const group = groups.get(key) ?? [];
    group.push(space);
    groups.set(key, group);
  }

  const result: MapPinDatum[] = [];

  for (const [clusterId, group] of groups) {
    const anchor = group[0]!;
    const latitude = anchor.latitude!;
    const longitude = anchor.longitude!;

    if (focusedClusterId === clusterId && group.length > 1) {
      for (let index = 0; index < group.length; index++) {
        const space = group[index]!;
        result.push({
          kind: 'spiderfy-space',
          pinKey: `sf-${space.id}`,
          space,
          clusterId,
          spiderfyIndex: index,
          spiderfyCount: group.length,
          latitude,
          longitude,
        });
      }
      continue;
    }

    if (group.length === 1) {
      const space = group[0]!;
      result.push({
        kind: 'space',
        pinKey: `s-${space.id}`,
        space,
        dimmed: focusedClusterId != null,
      });
      continue;
    }

    result.push({
      kind: 'cluster',
      pinKey: `c-${clusterId}`,
      clusterId,
      spaces: group,
      latitude,
      longitude,
      count: group.length,
      dimmed: focusedClusterId != null && focusedClusterId !== clusterId,
    });
  }

  return result;
}

/** Evenly spaced screen-space offsets for spiderfied pins. */
export function spiderfyOffsets(
  count: number,
  radius: number,
): { x: number; y: number }[] {
  if (count <= 1 || radius <= 0) {
    return [{ x: 0, y: 0 }];
  }

  const offsets: { x: number; y: number }[] = [];
  for (let index = 0; index < count; index++) {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }
  return offsets;
}

export function pinDatumSpace(datum: MapPinDatum): Space | null {
  if (datum.kind === 'space' || datum.kind === 'spiderfy-space') {
    return datum.space;
  }
  return null;
}
