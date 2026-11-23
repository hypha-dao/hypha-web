import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Real-database check of the queries behind the MCP feature functions. Runs only when a
 * database URL is set (`BRANCH_DB_URL` or `DEFAULT_DB_URL`); use a throwaway database. It
 * creates its own rows (slugs prefixed `mcp-it-`) and deletes them afterwards.
 */
vi.mock('server-only', () => ({}));
// importing the storage package and a cold serverless database are both slow
vi.setConfig({ testTimeout: 90_000, hookTimeout: 400_000 });

const HAS_DB = Boolean(process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL);
const PREFIX = `mcp-it-${Date.now()}`;

describe.skipIf(!HAS_DB)('queries behind the MCP features (database)', () => {
  let db: typeof import('@hypha-platform/storage-postgres')['db'];
  let tables: typeof import('@hypha-platform/storage-postgres');
  let spaceId: number;
  let otherSpaceId: number;
  let childId: number;

  const insertDoc = async (
    slug: string,
    over: Record<string, unknown>,
    createdAt: Date,
    sid = spaceId,
  ) => {
    await db.insert(tables.documents).values({
      creatorId: 1,
      spaceId: sid,
      title: slug,
      slug,
      createdAt,
      ...over,
    } as never);
  };

  beforeAll(async () => {
    // the module graph behind the queries is large; load it once, here, with the long hook timeout
    await import('../../governance/server/queries');
    await import('../../space/server/queries');
    tables = await import('@hypha-platform/storage-postgres');
    db = tables.db;
    const mk = async (slug: string, parentId?: number) =>
      (
        await db
          .insert(tables.spaces)
          .values({ title: slug, slug, parentId } as never)
          .returning({ id: tables.spaces.id })
      )[0]!.id;
    spaceId = await mk(`${PREFIX}-a`);
    otherSpaceId = await mk(`${PREFIX}-b`);
    childId = await mk(`${PREFIX}-child`, spaceId);

    const t = (n: number) => new Date(Date.UTC(2026, 0, n));
    // title only: its description column is null
    await insertDoc(
      `${PREFIX}-wolf`,
      { state: 'proposal', title: 'Wolfpack gathering' },
      t(8),
      otherSpaceId,
    );
    await insertDoc(
      `${PREFIX}-p1`,
      { state: 'proposal', web3ProposalId: 1 },
      t(1),
    );
    await insertDoc(
      `${PREFIX}-p2`,
      { state: 'agreement', web3ProposalId: 2 },
      t(2),
    );
    // same createdAt as p3: the id breaks the tie, so paging is stable
    await insertDoc(`${PREFIX}-p3`, { state: 'proposal' }, t(3));
    await insertDoc(`${PREFIX}-p4`, { state: 'proposal' }, t(3));
    await insertDoc(
      `${PREFIX}-quest`,
      { state: 'proposal', label: 'Quest', web3ProposalId: 5 },
      t(4),
    );
    await insertDoc(`${PREFIX}-talk`, { state: 'discussion' }, t(5));
    await insertDoc(`${PREFIX}-mem`, { state: 'memory' }, t(6));
    await insertDoc(
      `${PREFIX}-other`,
      { state: 'proposal', web3ProposalId: 9 },
      t(7),
      otherSpaceId,
    );
  });

  afterAll(async () => {
    if (!HAS_DB || !tables) return;
    const { like } = await import('drizzle-orm');
    await db
      .delete(tables.documents)
      .where(like(tables.documents.slug, `${PREFIX}%`));
    await db
      .delete(tables.spaces)
      .where(like(tables.spaces.slug, `${PREFIX}%`));
  });

  it('pages proposals and agreements only, newest first, ties by id, with a stable total', async () => {
    const { findProposalDocumentsPage } = await import(
      '../../governance/server/queries'
    );
    const states: ('proposal' | 'agreement')[] = ['proposal', 'agreement'];
    const first = await findProposalDocumentsPage(
      { spaceId, states, direction: 'desc', offset: 0, limit: 3 },
      { db },
    );
    const second = await findProposalDocumentsPage(
      { spaceId, states, direction: 'desc', offset: 3, limit: 3 },
      { db },
    );
    const slugs = [...first.data, ...second.data].map((d) => d.slug);
    expect(slugs).toEqual(
      ['quest', 'p4', 'p3', 'p2', 'p1'].map((s) => `${PREFIX}-${s}`),
    );
    expect(first.total).toBe(5);
    expect(second.total).toBe(5);
    // no discussion, no memory entry, nothing of the other space
    expect(slugs.join()).not.toMatch(/talk|mem|other/);
  });

  it('a Quest-labelled document is returned, stored as a proposal (V15)', async () => {
    const { findProposalDocumentsPage } = await import(
      '../../governance/server/queries'
    );
    const r = await findProposalDocumentsPage(
      {
        spaceId,
        states: ['proposal'],
        direction: 'desc',
        offset: 0,
        limit: 10,
      },
      { db },
    );
    const quest = r.data.find((d) => d.slug === `${PREFIX}-quest`);
    expect(quest).toMatchObject({ label: 'Quest', state: 'proposal' });
  });

  it('a title-only search finds a document whose description is null', async () => {
    const { findProposalDocumentsPage } = await import(
      '../../governance/server/queries'
    );
    const r = await findProposalDocumentsPage(
      {
        spaceId: otherSpaceId,
        states: ['proposal'],
        searchTerm: 'Wolfpack',
        direction: 'desc',
        offset: 0,
        limit: 10,
      },
      { db },
    );
    expect(r.data.map((d) => d.slug)).toEqual([`${PREFIX}-wolf`]);
  });

  it('the state filter and ascending order work; an offset past the end keeps the total', async () => {
    const { findProposalDocumentsPage } = await import(
      '../../governance/server/queries'
    );
    const agreements = await findProposalDocumentsPage(
      {
        spaceId,
        states: ['agreement'],
        direction: 'asc',
        offset: 0,
        limit: 10,
      },
      { db },
    );
    expect(agreements.data.map((d) => d.slug)).toEqual([`${PREFIX}-p2`]);
    const past = await findProposalDocumentsPage(
      {
        spaceId,
        states: ['proposal', 'agreement'],
        direction: 'desc',
        offset: 50,
        limit: 10,
      },
      { db },
    );
    expect(past.data).toEqual([]);
    expect(past.total).toBe(5);
  });

  it('finds the vote reference inside the asked space only, and only for proposals and agreements', async () => {
    const { findProposalVoteRefBySlug } = await import(
      '../../governance/server/queries'
    );
    expect(
      await findProposalVoteRefBySlug(
        { spaceId, slug: `${PREFIX}-p1` },
        { db },
      ),
    ).toMatchObject({ web3ProposalId: 1, state: 'proposal' });
    expect(
      await findProposalVoteRefBySlug(
        { spaceId: otherSpaceId, slug: `${PREFIX}-p1` },
        { db },
      ),
    ).toBeNull();
    expect(
      await findProposalVoteRefBySlug(
        { spaceId, slug: `${PREFIX}-talk` },
        { db },
      ),
    ).toBeNull();
    expect(
      await findProposalVoteRefBySlug(
        { spaceId, slug: `${PREFIX}-mem` },
        { db },
      ),
    ).toBeNull();
  });

  it('loads a space with its sub-spaces and nothing else', async () => {
    const { findSpaceWithSubspacesBySlug } = await import(
      '../../space/server/queries'
    );
    const space = await findSpaceWithSubspacesBySlug(
      { slug: `${PREFIX}-a` },
      { db },
    );
    expect(space?.subspaces.map((s) => s.id)).toEqual([childId]);
    expect(space).not.toHaveProperty('documents');
    expect(space).not.toHaveProperty('members');
    expect(
      await findSpaceWithSubspacesBySlug({ slug: `${PREFIX}-nope` }, { db }),
    ).toBeNull();
  });
});
