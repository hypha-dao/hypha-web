import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Row = {
  id: number;
  slug: string;
  title: string;
  web3SpaceId: number;
};

function dbReturning(rows: Row[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    then: (
      resolve: (value: Row[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject),
  };
  return { select: () => chain };
}

async function loadFindSpaceByWeb3Id() {
  const originalDefaultDbUrl = process.env.DEFAULT_DB_URL;
  if (!originalDefaultDbUrl) {
    process.env.DEFAULT_DB_URL = 'postgres://local:test@localhost:5432/test';
  }
  try {
    const mod = await import('../queries');
    return mod.findSpaceByWeb3Id;
  } finally {
    if (originalDefaultDbUrl === undefined) {
      delete process.env.DEFAULT_DB_URL;
    } else {
      process.env.DEFAULT_DB_URL = originalDefaultDbUrl;
    }
  }
}

const hypha: Row = {
  id: 94,
  slug: 'hypha',
  title: 'Hypha',
  web3SpaceId: 240,
};
const probe: Row = {
  id: 853,
  slug: 'zz-w3-probe-1220',
  title: 'Probe',
  web3SpaceId: 240,
};

describe('findSpaceByWeb3Id', () => {
  let findSpaceByWeb3Id: Awaited<ReturnType<typeof loadFindSpaceByWeb3Id>>;

  beforeEach(async () => {
    findSpaceByWeb3Id = await loadFindSpaceByWeb3Id();
  });

  it('prefers the non-probe row when two spaces share a web3SpaceId', async () => {
    const space = await findSpaceByWeb3Id(
      { id: 240 },
      { db: dbReturning([probe, hypha]) as never },
    );

    expect(space?.id).toBe(94);
    expect(space?.slug).toBe('hypha');
  });

  it('orders non-probe matches by id', async () => {
    const later = { ...hypha, id: 300, slug: 'later-space' };
    const earlier = { ...hypha, id: 12, slug: 'earlier-space' };
    const space = await findSpaceByWeb3Id(
      { id: 240 },
      { db: dbReturning([probe, later, earlier]) as never },
    );

    expect(space?.id).toBe(12);
    expect(space?.slug).toBe('earlier-space');
  });

  it('returns the probe when it is the only match', async () => {
    const space = await findSpaceByWeb3Id(
      { id: 240 },
      { db: dbReturning([probe]) as never },
    );

    expect(space?.id).toBe(853);
    expect(space?.slug).toBe('zz-w3-probe-1220');
  });
});
