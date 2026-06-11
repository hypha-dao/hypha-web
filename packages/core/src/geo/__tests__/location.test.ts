import { describe, expect, it } from 'vitest';

import {
  buildLocatedAtPatch,
  isNullIsland,
  mapNominatimResults,
  normalizeGeocodeQuery,
} from '../location';
import { geocodeRequestSchema, spaceLocationFieldsSchema } from '../validation';

describe('normalizeGeocodeQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeGeocodeQuery('  Berlin   Germany  ')).toBe(
      'berlin germany',
    );
  });
});

describe('isNullIsland', () => {
  it('detects coordinates near 0,0', () => {
    expect(isNullIsland(0, 0)).toBe(true);
    expect(isNullIsland(0.5, 10)).toBe(false);
  });
});

describe('mapNominatimResults', () => {
  it('maps valid rows and drops null island', () => {
    const results = mapNominatimResults([
      {
        place_id: 1,
        display_name: 'Berlin, Germany',
        lat: '52.52',
        lon: '13.405',
      },
      {
        place_id: 2,
        display_name: 'Null Island',
        lat: '0',
        lon: '0',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: 'Berlin, Germany',
      latitude: 52.52,
      longitude: 13.405,
      placeId: '1',
    });
  });
});

describe('buildLocatedAtPatch', () => {
  it('sets locatedAt when coordinates are provided', () => {
    const patch = buildLocatedAtPatch({ latitude: 1, longitude: 2 });
    expect(patch.locatedAt).toBeInstanceOf(Date);
  });

  it('clears locatedAt when coordinates are cleared', () => {
    expect(buildLocatedAtPatch({ latitude: null, longitude: null })).toEqual({
      locatedAt: null,
    });
  });

  it('returns empty patch when coordinates are omitted', () => {
    expect(buildLocatedAtPatch({})).toEqual({});
  });
});

describe('spaceLocationFieldsSchema', () => {
  it('requires paired latitude and longitude', () => {
    const result = spaceLocationFieldsSchema.safeParse({
      latitude: 10,
    });
    expect(result.success).toBe(false);
  });

  it('accepts cleared coordinates', () => {
    const result = spaceLocationFieldsSchema.safeParse({
      latitude: null,
      longitude: null,
      locationLabel: null,
      locationSource: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('geocodeRequestSchema', () => {
  it('rejects very short queries', () => {
    expect(geocodeRequestSchema.safeParse({ query: 'a' }).success).toBe(false);
  });
});
