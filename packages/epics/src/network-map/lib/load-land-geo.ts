import * as d3 from 'd3';
import { feature } from 'topojson-client';

/** Natural Earth 50m — cleaner coasts than 110m without 10m payload weight. */
export const GEO_LAND_URL = '/geo/land-50m.json';

type LandTopology = Parameters<typeof feature>[0] & {
  objects: { land: Parameters<typeof feature>[1] };
};

let cachedLandGeo: Promise<d3.GeoPermissibleObjects> | null = null;

export async function loadLandGeo(): Promise<d3.GeoPermissibleObjects> {
  if (!cachedLandGeo) {
    cachedLandGeo = (async () => {
      const response = await fetch(GEO_LAND_URL);
      if (!response.ok) {
        throw new Error(`Failed to load map data (${response.status})`);
      }

      const topology = (await response.json()) as LandTopology;
      return feature(
        topology,
        topology.objects.land,
      ) as d3.GeoPermissibleObjects;
    })().catch((error) => {
      cachedLandGeo = null;
      throw error;
    });
  }

  return cachedLandGeo;
}
