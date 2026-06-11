import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('server-only', () => ({}));

import {
  clearGeocodeCacheForTests,
  searchNominatim,
} from '../server/nominatim';

const fetchMock = vi.fn();
const prevNominatimUserAgent = process.env.NOMINATIM_USER_AGENT;

vi.stubGlobal('fetch', fetchMock);

describe('searchNominatim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    clearGeocodeCacheForTests();
    process.env.NOMINATIM_USER_AGENT = 'HyphaTest/1.0';
  });

  afterEach(() => {
    clearGeocodeCacheForTests();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (prevNominatimUserAgent === undefined) {
      delete process.env.NOMINATIM_USER_AGENT;
    } else {
      process.env.NOMINATIM_USER_AGENT = prevNominatimUserAgent;
    }
  });

  it('returns mapped results from Nominatim', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 42,
          display_name: 'Lisbon, Portugal',
          lat: '38.7223',
          lon: '-9.1393',
        },
      ],
    });

    const results = await searchNominatim('Lisbon', 5);

    expect(results).toEqual([
      {
        label: 'Lisbon, Portugal',
        latitude: 38.7223,
        longitude: -9.1393,
        placeId: '42',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves cached results without a second fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 7,
          display_name: 'Oslo, Norway',
          lat: '59.9139',
          lon: '10.7522',
        },
      ],
    });

    await searchNominatim('Oslo', 5);
    await searchNominatim('oslo', 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
