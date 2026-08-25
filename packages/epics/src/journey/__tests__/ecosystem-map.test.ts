import { describe, expect, it } from 'vitest';
import * as d3 from 'd3';
import {
  createWorldProjection,
  dimensionForSpace,
  projectLngLat,
} from '../ecosystem-map';

describe('ecosystem-map', () => {
  it('maps space categories onto wellbeing dimensions', () => {
    expect(dimensionForSpace(['health-care'], 0)).toBe('being');
    expect(dimensionForSpace(['education'], 0)).toBe('thinking');
    expect(dimensionForSpace(['community'], 0)).toBe('relating');
    expect(dimensionForSpace(['dao'], 0)).toBe('collaborating');
    expect(dimensionForSpace(['energy'], 0)).toBe('acting');
    expect(dimensionForSpace([], 2)).toBe('relating');
  });

  it('projects west-to-east longitude with D3 equirectangular', () => {
    const projection = createWorldProjection(null);
    const newYork = projectLngLat(projection, 40.7, -74);
    const london = projectLngLat(projection, 51.5, -0.13);
    const tokyo = projectLngLat(projection, 35.7, 139.7);

    expect(newYork).not.toBeNull();
    expect(london).not.toBeNull();
    expect(tokyo).not.toBeNull();
    expect(london!.x).toBeGreaterThan(newYork!.x);
    expect(tokyo!.x).toBeGreaterThan(london!.x);
    expect(london!.y).toBeLessThan(newYork!.y);
  });

  it('traces land into an SVG path with the same projection', () => {
    const land: d3.GeoPermissibleObjects = {
      type: 'Polygon',
      coordinates: [
        [
          [-10, 40],
          [10, 40],
          [10, 60],
          [-10, 60],
          [-10, 40],
        ],
      ],
    };
    const projection = createWorldProjection(land);
    const path = d3.geoPath(projection)(land);

    expect(path).toBeTruthy();
    expect(path).toContain('M');
  });
});
