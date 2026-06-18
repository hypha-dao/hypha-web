import { describe, expect, it } from 'vitest';

import {
  buildLocatedAtPatch,
  hasSpaceMapLocation,
  isNullIsland,
  mapNominatimResults,
  normalizeGeocodeQuery,
  normalizeSpaceLocationFields,
  parseCoordinateInput,
  prepareGeocodeQueries,
  simplifyGeocodeQuery,
} from '../location';
import { geocodeRequestSchema, spaceLocationFieldsSchema } from '../validation';

describe('normalizeGeocodeQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeGeocodeQuery('  Berlin   Germany  ')).toBe(
      'berlin germany',
    );
  });
});

describe('simplifyGeocodeQuery', () => {
  it('strips unit suffixes from street addresses', () => {
    expect(
      simplifyGeocodeQuery(
        'Slotermeerlaan 69-Unit D8, 1064 HA Amsterdam, Netherlands',
      ),
    ).toBe('Slotermeerlaan 69, 1064 HA Amsterdam, Netherlands');
  });
});

describe('prepareGeocodeQueries', () => {
  it('returns relaxed variants after the original query', () => {
    const variants = prepareGeocodeQueries(
      'Slotermeerlaan 69-Unit D8, 1064 HA Amsterdam, Netherlands',
    );

    expect(variants[0]).toBe(
      'Slotermeerlaan 69-Unit D8, 1064 HA Amsterdam, Netherlands',
    );
    expect(variants).toContain(
      'Slotermeerlaan 69, 1064 HA Amsterdam, Netherlands',
    );
  });
});

describe('parseCoordinateInput', () => {
  it('parses decimal strings with comma separators', () => {
    expect(parseCoordinateInput('52,3676')).toBe(52.3676);
    expect(parseCoordinateInput('4.9041')).toBe(4.9041);
  });

  it('returns null for invalid values', () => {
    expect(parseCoordinateInput('')).toBeNull();
    expect(parseCoordinateInput('abc')).toBeNull();
  });
});

describe('normalizeSpaceLocationFields', () => {
  it('clears mismatched coordinates before save', () => {
    expect(
      normalizeSpaceLocationFields({
        latitude: 52.3,
        longitude: null,
        locationSource: 'manual',
      }),
    ).toEqual({
      latitude: null,
      longitude: null,
      locationLabel: null,
      locationSource: null,
    });
  });

  it('rounds valid coordinate pairs', () => {
    expect(
      normalizeSpaceLocationFields({
        latitude: 52.367584,
        longitude: 4.904139,
        locationLabel: 'Amsterdam',
        locationSource: 'geocode',
      }),
    ).toMatchObject({
      latitude: 52.367584,
      longitude: 4.904139,
      locationLabel: 'Amsterdam',
      locationSource: 'geocode',
    });
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

  it('drops coordinates outside valid latitude and longitude bounds', () => {
    const results = mapNominatimResults([
      {
        place_id: 3,
        display_name: 'Invalid latitude',
        lat: '91',
        lon: '10',
      },
      {
        place_id: 4,
        display_name: 'Invalid longitude',
        lat: '10',
        lon: '181',
      },
      {
        place_id: 5,
        display_name: 'Valid location',
        lat: '48.8566',
        lon: '2.3522',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: 'Valid location',
      latitude: 48.8566,
      longitude: 2.3522,
      placeId: '5',
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

describe('hasSpaceMapLocation', () => {
  it('returns true only for finite coordinate pairs', () => {
    expect(hasSpaceMapLocation({ latitude: 10, longitude: 20 })).toBe(true);
    expect(hasSpaceMapLocation({ latitude: null, longitude: null })).toBe(
      false,
    );
    expect(hasSpaceMapLocation({ latitude: 10 })).toBe(false);
  });
});
