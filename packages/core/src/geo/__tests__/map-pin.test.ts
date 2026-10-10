import { describe, expect, it } from 'vitest';

import {
  deterministicMapPin,
  isContinentalLandPin,
  resolveSpaceMapPin,
} from '../map-pin';

describe('deterministicMapPin', () => {
  it('returns the same point for the same space id', () => {
    expect(deterministicMapPin(42)).toEqual(deterministicMapPin(42));
  });

  it('spreads different spaces across the map bounds', () => {
    const pins = Array.from({ length: 40 }, (_, index) =>
      deterministicMapPin(index + 1),
    );
    const latitudes = pins.map((pin) => pin.latitude);
    const longitudes = pins.map((pin) => pin.longitude);

    expect(Math.max(...latitudes) - Math.min(...latitudes)).toBeGreaterThan(40);
    expect(Math.max(...longitudes) - Math.min(...longitudes)).toBeGreaterThan(
      90,
    );
    expect(
      new Set(pins.map((pin) => `${pin.latitude},${pin.longitude}`)).size,
    ).toBe(40);

    for (const pin of pins) {
      expect(isContinentalLandPin(pin.latitude, pin.longitude)).toBe(true);
    }
  });

  it('does not place a fallback pin in open ocean', () => {
    const ocean = [
      { latitude: 0, longitude: -30 },
      { latitude: 0, longitude: -160 },
      { latitude: -50, longitude: 20 },
      { latitude: 20, longitude: 70 },
    ];
    for (const point of ocean) {
      expect(isContinentalLandPin(point.latitude, point.longitude)).toBe(false);
    }
  });
});

describe('resolveSpaceMapPin', () => {
  it('uses the space coordinates when they exist', () => {
    const space = { spaceId: 7, latitude: 41.1, longitude: -8.6 };
    expect(
      resolveSpaceMapPin({
        ...space,
        creatorCoordinates: { latitude: 10, longitude: 20 },
      }),
    ).toEqual({ latitude: 41.1, longitude: -8.6, source: 'space' });
    expect(space).toEqual({ spaceId: 7, latitude: 41.1, longitude: -8.6 });
  });

  it('uses a geocoded creator location when the space has none', () => {
    expect(
      resolveSpaceMapPin({
        spaceId: 7,
        latitude: null,
        longitude: null,
        creatorCoordinates: { latitude: 52.3, longitude: 4.9 },
      }),
    ).toEqual({ latitude: 52.3, longitude: 4.9, source: 'creator' });
  });

  it('assigns a deterministic fallback when the creator has no location', () => {
    const first = resolveSpaceMapPin({
      spaceId: 9,
      latitude: null,
      longitude: null,
      creatorCoordinates: null,
    });
    const second = resolveSpaceMapPin({ spaceId: 9 });

    expect(first.source).toBe('fallback');
    expect(first).toEqual(second);
    expect(first).not.toEqual(
      resolveSpaceMapPin({ spaceId: 10, latitude: null, longitude: null }),
    );
  });

  it('ignores null island as a creator location', () => {
    const pin = resolveSpaceMapPin({
      spaceId: 3,
      creatorCoordinates: { latitude: 0, longitude: 0 },
    });
    expect(pin.source).toBe('fallback');
    expect(pin.latitude === 0 && pin.longitude === 0).toBe(false);
  });
});
