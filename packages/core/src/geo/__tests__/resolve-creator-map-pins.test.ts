import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@hypha-platform/storage-postgres', async () => {
  const { pgTable, serial, text } = await import('drizzle-orm/pg-core');
  return {
    people: pgTable('people', {
      id: serial('id').primaryKey(),
      address: text('web3_address'),
      location: text('location'),
      sub: text('sub'),
    }),
  };
});

import {
  creatorLocationQueries,
  normalizeCreatorAddress,
  resolveCreatorMapCoordinates,
  type CreatorPersonRow,
} from '../server/resolve-creator-map-pins';

const deployer = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';

function fakeDb(rows: CreatorPersonRow[]) {
  return {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
    update: () => {
      throw new Error('creator pins must not update a space');
    },
    insert: () => {
      throw new Error('creator pins must not insert a space');
    },
  };
}

describe('creatorLocationQueries', () => {
  const people: CreatorPersonRow[] = [
    {
      address: deployer.toUpperCase(),
      location: 'Lisbon, Portugal',
      sub: 'did:privy:creator',
    },
    {
      address: '0x1111111111111111111111111111111111111111',
      location: 'Oslo',
      sub: 'space:4',
    },
    {
      address: '0x2222222222222222222222222222222222222222',
      location: '  ',
      sub: 'did:privy:empty',
    },
  ];

  it('uses the deployer location when the space has no coordinates', () => {
    const rows: CreatorPersonRow[] = [
      {
        address: deployer.toUpperCase(),
        location: 'Lisbon, Portugal',
        sub: 'did:privy:creator',
      },
    ];
    const queries = creatorLocationQueries(
      [{ id: 8, latitude: null, longitude: null, creatorAddress: deployer }],
      rows,
    );
    expect(normalizeCreatorAddress(deployer.toUpperCase())).toBe(deployer);
    expect([...queries.entries()]).toEqual([[8, 'Lisbon, Portugal']]);
  });

  it('skips spaces that already have coordinates', () => {
    const queries = creatorLocationQueries(
      [
        {
          id: 8,
          latitude: 1,
          longitude: 2,
          creatorAddress: deployer,
        },
      ],
      people,
    );
    expect(queries.size).toBe(0);
  });

  it('skips space actors, blank locations, and unknown deployers', () => {
    const queries = creatorLocationQueries(
      [
        {
          id: 1,
          creatorAddress: '0x1111111111111111111111111111111111111111',
        },
        {
          id: 2,
          creatorAddress: '0x2222222222222222222222222222222222222222',
        },
        {
          id: 3,
          creatorAddress: '0x3333333333333333333333333333333333333333',
        },
        {
          id: 4,
          creatorAddress: '0x0000000000000000000000000000000000000000',
        },
      ],
      people,
    );
    expect(queries.size).toBe(0);
  });
});

describe('resolveCreatorMapCoordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns geocoded creator coordinates without writing them onto a space', async () => {
    const geocode = vi.fn().mockResolvedValue([
      {
        label: 'Lisbon',
        latitude: 38.7,
        longitude: -9.1,
      },
    ]);
    const db = fakeDb([
      {
        address: deployer,
        location: 'Lisbon',
        sub: 'did:privy:creator',
      },
    ]);

    const pins = await resolveCreatorMapCoordinates(
      [{ id: 12, latitude: null, longitude: null, creatorAddress: deployer }],
      { db: db as never },
      geocode,
    );

    expect(pins).toEqual({ 12: { latitude: 38.7, longitude: -9.1 } });
    expect(geocode).toHaveBeenCalledWith('Lisbon', 1);
  });

  it('omits a space when the creator location does not geocode', async () => {
    const geocode = vi.fn().mockResolvedValue([]);
    const db = fakeDb([
      {
        address: deployer,
        location: 'Not a place',
        sub: 'did:privy:creator',
      },
    ]);

    const pins = await resolveCreatorMapCoordinates(
      [{ id: 12, creatorAddress: deployer }],
      { db: db as never },
      geocode,
    );

    expect(pins).toEqual({});
  });
});
