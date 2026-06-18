import * as d3 from 'd3';
import { feature } from 'topojson-client';

export const GEO_LAND_URL = '/geo/land-110m.json';

type LandTopology = Parameters<typeof feature>[0] & {
  objects: { land: Parameters<typeof feature>[1] };
};

export async function loadLandGeo(): Promise<d3.GeoPermissibleObjects> {
  const response = await fetch(GEO_LAND_URL);
  if (!response.ok) {
    throw new Error(`Failed to load map data (${response.status})`);
  }

  const topology = (await response.json()) as LandTopology;
  return feature(topology, topology.objects.land) as d3.GeoPermissibleObjects;
}
