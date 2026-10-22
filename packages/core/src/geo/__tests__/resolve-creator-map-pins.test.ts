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
  chooseFallbackLocations,
  coordinatesFromLocationText,
  creatorLocationQueries,
  geocodeOrder,
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

  it('uses another member when the creator has no place', () => {
    const member = '0x4444444444444444444444444444444444444444';
    const laterMember = '0x5555555555555555555555555555555555555555';
    const rows: CreatorPersonRow[] = [
      {
        address: deployer,
        location: '  ',
        sub: 'did:privy:creator',
      },
      {
        address: member.toUpperCase(),
        location: 'Nairobi',
        sub: 'did:privy:member',
      },
      {
        address: laterMember,
        location: 'Tokyo',
        sub: 'did:privy:later',
      },
    ];
    const queries = creatorLocationQueries(
      [
        {
          id: 9,
          creatorAddress: deployer,
          memberAddresses: [laterMember, member, deployer],
        },
      ],
      rows,
    );
    expect([...queries.entries()]).toEqual([[9, 'Nairobi']]);
    expect(
      chooseFallbackLocations(
        [
          {
            id: 9,
            creatorAddress: deployer,
            memberAddresses: [laterMember, member],
          },
        ],
        rows,
      )[0]?.source,
    ).toBe('member');
  });

  it('keeps the creator place ahead of a member place', () => {
    const member = '0x4444444444444444444444444444444444444444';
    const choices = chooseFallbackLocations(
      [
        {
          id: 8,
          creatorAddress: deployer,
          memberAddresses: [member],
        },
        {
          id: 9,
          memberAddresses: [member],
        },
      ],
      [
        ...people,
        {
          address: member,
          location: 'Nairobi',
          sub: 'did:privy:member',
        },
      ],
    );
    expect(choices.map((choice) => [choice.spaceId, choice.source])).toEqual([
      [8, 'creator'],
      [9, 'member'],
    ]);
    expect(geocodeOrder(choices)).toEqual(['Lisbon, Portugal', 'Nairobi']);
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

  it('reads a coordinate pair from the profile without calling the geocoder', async () => {
    const geocode = vi.fn();
    const db = fakeDb([
      {
        address: deployer,
        location: '52.3, 4.9',
        sub: 'did:privy:creator',
      },
    ]);

    const pins = await resolveCreatorMapCoordinates(
      [{ id: 12, creatorAddress: deployer }],
      { db: db as never },
      geocode,
    );

    expect(coordinatesFromLocationText('52.3, 4.9')).toEqual({
      latitude: 52.3,
      longitude: 4.9,
    });
    expect(pins).toEqual({ 12: { latitude: 52.3, longitude: 4.9 } });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('reports a pin as soon as its place resolves', async () => {
    const batches: Array<
      Record<number, { latitude: number; longitude: number }>
    > = [];
    const geocode = vi
      .fn()
      .mockResolvedValue([
        { label: 'Lisbon', latitude: 38.7, longitude: -9.1 },
      ]);
    const db = fakeDb([
      {
        address: deployer,
        location: 'Lisbon',
        sub: 'did:privy:creator',
      },
    ]);

    await resolveCreatorMapCoordinates(
      [{ id: 12, creatorAddress: deployer }],
      { db: db as never },
      geocode,
      (pins) => {
        batches.push(pins);
      },
    );

    expect(batches).toEqual([{ 12: { latitude: 38.7, longitude: -9.1 } }]);
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
