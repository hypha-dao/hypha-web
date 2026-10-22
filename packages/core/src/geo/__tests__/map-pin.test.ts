import { describe, expect, it } from 'vitest';

import { resolveSpaceMapPin } from '../map-pin';

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

  it('returns null when neither the space nor the creator has a place', () => {
    expect(
      resolveSpaceMapPin({
        spaceId: 9,
        latitude: null,
        longitude: null,
        creatorCoordinates: null,
      }),
    ).toBeNull();
    expect(resolveSpaceMapPin({ spaceId: 9 })).toBeNull();
  });

  it('ignores null island as a creator location', () => {
    expect(
      resolveSpaceMapPin({
        spaceId: 3,
        creatorCoordinates: { latitude: 0, longitude: 0 },
      }),
    ).toBeNull();
  });
});
