import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Real-database check of the SQL behind `hypha_list_signals`. Runs only when a database URL
 * is set (`BRANCH_DB_URL` or `DEFAULT_DB_URL`); use a throwaway database that has run the
 * migrations. It creates its own rows (slugs prefixed `mcp-sig-`) and deletes them afterwards.
 */
vi.mock('server-only', () => ({}));
vi.setConfig({ testTimeout: 90_000, hookTimeout: 400_000 });

const HAS_DB = Boolean(process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL);
const PREFIX = `mcp-sig-${Date.now()}`;

describe.skipIf(!HAS_DB)('signals queries (database)', () => {
  let db: typeof import('@hypha-platform/storage-postgres')['db'];
  let tables: typeof import('@hypha-platform/storage-postgres');
  let q: typeof import('../../coherence/server/list-signals-queries');
  let spaceId: number;
  let otherSpaceId: number;
  let ada: number;
  let grace: number;
  const ids: Record<string, number> = {};
  const workflow = { boardSlugs: ['general'], defaultBoard: 'general' };
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  const slugs = (rows: { slug: string }[]) =>
    rows.map((row) => row.slug.replace(`${PREFIX}-`, ''));

  beforeAll(async () => {
    q = await import('../../coherence/server/list-signals-queries');
    tables = await import('@hypha-platform/storage-postgres');
    db = tables.db;
    const { sql } = await import('drizzle-orm');

    const mkSpace = async (slug: string) =>
      (
        await db
          .insert(tables.spaces)
          .values({ title: slug, slug } as never)
          .returning({ id: tables.spaces.id })
      )[0]!.id;
    spaceId = await mkSpace(`${PREFIX}-a`);
    otherSpaceId = await mkSpace(`${PREFIX}-b`);

    const mkPerson = async (name: string, surname: string) =>
      (
        await db
          .insert(tables.people)
          .values({
            sub: `${PREFIX}-${name}`,
            slug: `${PREFIX}-${name}`,
            name,
            surname,
          } as never)
          .returning({ id: tables.people.id })
      )[0]!.id;
    ada = await mkPerson('Ada', 'Lovelace');
    grace = await mkPerson('Grace', 'Hopper');

    const past = new Date(Date.now() - 3 * 86_400_000);
    const future = new Date(Date.now() + 3 * 86_400_000);
    const add = async (key: string, over: Record<string, unknown>) => {
      const row = (
        await db
          .insert(tables.coherences)
          .values({
            spaceId,
            title: `Signal ${key}`,
            description: `Description of ${key}`,
            type: 'Need',
            priority: 'medium',
            slug: `${PREFIX}-${key}`,
            creatorId: ada,
            ...over,
          } as never)
          .returning({ id: tables.coherences.id })
      )[0]!;
      ids[key] = row.id;
    };
    await add('s1', {
      type: 'Need',
      priority: 'high',
      tags: ['Water', 'community'],
      messages: 5,
      createdAt: day(1),
      updatedAt: day(11),
      indicativePayouts: [
        { amount: '100', token: '0xAbC0000000000000000000000000000000000123' },
      ],
    });
    await add('s2', {
      type: 'Risk',
      tags: ['ai signal'],
      archived: true,
      createdAt: day(2),
      updatedAt: day(2),
    });
    // unknown type and priority read as Opportunity and medium; same createdAt as s5 (id breaks the tie)
    await add('s3', {
      type: 'something-old',
      priority: null,
      creatorId: grace,
      createdAt: day(3),
      updatedAt: day(3),
    });
    await add('s4', {
      type: 'Tension',
      priority: 'low',
      progressStatus: 'in_progress',
      board: 'general',
      assigneeIds: [ada],
      dueAt: past,
      createdAt: day(4),
      updatedAt: day(4),
    });
    await add('s5', {
      type: 'Need',
      assigneeIds: [String(grace)],
      dueAt: future,
      tags: ['Water'],
      createdAt: day(3),
      updatedAt: day(3),
    });
    // another space: must never come back
    await add('other', {
      spaceId: otherSpaceId,
      type: 'Need',
      tags: ['Water'],
      createdAt: day(5),
    });
    await db.execute(
      sql`update coherences set capitals = ${JSON.stringify([
        'social',
        'wisdom',
      ])}::jsonb where id = ${ids.s1}`,
    );
    await db.insert(tables.coherenceUpvotes).values([
      {
        coherenceId: ids.s1,
        personId: ada,
        votingPower: '100',
        maxVotingPower: '100',
        tokenDecimals: 0,
        direction: 'up',
      },
      {
        coherenceId: ids.s1,
        personId: grace,
        votingPower: '30',
        maxVotingPower: '30',
        tokenDecimals: 0,
        direction: 'down',
      },
      {
        coherenceId: ids.s5,
        personId: grace,
        votingPower: '10',
        maxVotingPower: '10',
        tokenDecimals: 0,
        direction: 'up',
      },
    ] as never);
    await db.insert(tables.tokens).values({
      name: `${PREFIX}-token`,
      symbol: 'MCPIT',
      maxSupply: 1,
      type: 'utility',
      transferable: true,
      isVotingToken: false,
      address: '0xabc0000000000000000000000000000000000123',
    } as never);
  });

  afterAll(async () => {
    if (!HAS_DB || !tables) return;
    const { like } = await import('drizzle-orm');
    await db
      .delete(tables.coherences)
      .where(like(tables.coherences.slug, `${PREFIX}%`));
    await db
      .delete(tables.tokens)
      .where(like(tables.tokens.name, `${PREFIX}%`));
    await db
      .delete(tables.people)
      .where(like(tables.people.slug, `${PREFIX}%`));
    await db
      .delete(tables.spaces)
      .where(like(tables.spaces.slug, `${PREFIX}%`));
  });

  const page = (
    filter: Record<string, unknown> = {},
    over: Record<string, unknown> = {},
  ) =>
    q.selectSignalsPage({ db }, {
      filter: { spaceId, ...filter },
      workflow,
      order: 'mostrecent',
      offset: 0,
      limit: 20,
      descriptionChars: 'all',
      ...over,
    } as never);

  it('pages newest first, ties by id, without archived and never from another space', async () => {
    const rows = await page();
    expect(slugs(rows)).toEqual(['s4', 's5', 's3', 's1']);
    const first = await page({}, { limit: 2, offset: 0 });
    const second = await page({}, { limit: 2, offset: 2 });
    expect([...slugs(first), ...slugs(second)]).toEqual([
      's4',
      's5',
      's3',
      's1',
    ]);
    const withArchived = await page({ includeArchived: true });
    expect(slugs(withArchived)).toContain('s2');
    expect(slugs(withArchived)).not.toContain('other');
  });

  it('reads stored values as the signals page shows them', async () => {
    const rows = await page({ includeArchived: true });
    const s3 = rows.find((row) => row.slug.endsWith('-s3'))!;
    expect(s3.type).toBe('Opportunity');
    expect(s3.priority).toBe('medium');
    expect(s3.status).toBe('backlog');
    expect(s3.board).toBe('general');
    expect(s3.creatorName).toBe('Grace Hopper');
    const s1 = rows.find((row) => row.slug.endsWith('-s1'))!;
    expect(s1.createdAt).toBe(day(1).toISOString());
    expect(s1.updatedAt).toBe(day(11).toISOString());
    expect(s1.capitals).toEqual(['social', 'wisdom']);
  });

  it('filters by type, priority, tags (any of, any case), text, creator and updatedSince', async () => {
    expect(slugs(await page({ type: 'Need' }))).toEqual(['s5', 's1']);
    expect(slugs(await page({ type: 'Opportunity' }))).toEqual(['s3']);
    expect(slugs(await page({ priority: 'medium' }))).toEqual(['s5', 's3']);
    expect(slugs(await page({ tags: ['WATER'] }))).toEqual(['s5', 's1']);
    expect(slugs(await page({ tags: ['nothing', 'community'] }))).toEqual([
      's1',
    ]);
    expect(
      slugs(await page({ tags: ['AI SIGNAL'], includeArchived: true })),
    ).toEqual(['s2']);
    expect(slugs(await page({ query: 'signal s3' }))).toEqual(['s3']);
    expect(slugs(await page({ query: 'DESCRIPTION OF s4' }))).toEqual(['s4']);
    expect(slugs(await page({ createdByPersonId: grace }))).toEqual(['s3']);
    expect(slugs(await page({ updatedSince: day(4) }))).toEqual(['s4', 's1']);
  });

  it('the legacy filters follow the stored task fields', async () => {
    expect(slugs(await page({ legacy: { status: 'backlog' } }))).toEqual([
      's5',
      's3',
      's1',
    ]);
    expect(slugs(await page({ legacy: { status: 'in_progress' } }))).toEqual([
      's4',
    ]);
    expect(slugs(await page({ legacy: { board: 'general' } })).length).toBe(4);
    expect(slugs(await page({ legacy: { overdue: true } }))).toEqual(['s4']);
    expect(slugs(await page({ legacy: { assignedToPersonId: ada } }))).toEqual([
      's4',
    ]);
    // an id stored as text is still the same person
    expect(
      slugs(await page({ legacy: { assignedToPersonId: grace } })),
    ).toEqual(['s5']);
  });

  it('orders by upvotes (net) and by messages, stably', async () => {
    expect(slugs(await page({}, { order: 'mostupvoted' }))).toEqual([
      's1',
      's5',
      's4',
      's3',
    ]);
    expect(slugs(await page({}, { order: 'mostmessages' }))[0]).toBe('s1');
  });

  it('the summary counts the whole filtered set with the same WHERE as the page', async () => {
    const summary = await q.summariseSignals({ db }, { spaceId }, workflow);
    expect(summary.total).toBe(4);
    expect(summary.byType.get('Need')).toBe(2);
    expect(summary.byType.get('Opportunity')).toBe(1);
    expect(summary.byType.get('Tension')).toBe(1);
    expect(summary.byPriority.get('medium')).toBe(2);
    expect(summary.byPriority.get('high')).toBe(1);
    expect(summary.byStatus.get('backlog')).toBe(3);
    expect(summary.byStatus.get('in_progress')).toBe(1);
    expect(summary.byBoard.get('general')).toBe(4);
    expect(summary.overdue).toBe(1);
    expect(summary.unassigned).toBe(2);
    const filtered = await q.summariseSignals(
      { db },
      { spaceId, type: 'Need' },
      workflow,
    );
    expect(filtered.total).toBe(2);
    expect(
      await q.countSignals({ db }, { spaceId, type: 'Need' }, workflow),
    ).toBe(2);
    const tags = await q.selectTopSignalTags({ db }, { spaceId }, workflow, 10);
    expect(tags[0]).toEqual({ tag: 'Water', count: 2 });
    expect(tags.map((t) => t.tag)).toContain('community');
    expect(tags.map((t) => t.tag)).not.toContain('ai signal'); // archived
  });

  it('vote totals are net, carry the viewer vote and no voter identity', async () => {
    const asAda = await q.selectSignalUpvotes(
      { db },
      [ids.s1!, ids.s5!, ids.s4!],
      ada,
    );
    const s1 = asAda.get(ids.s1!)!;
    expect(s1).toMatchObject({
      upCount: 1,
      downCount: 1,
      totalVotingPower: '70',
      myDirection: 'up',
    });
    expect(asAda.get(ids.s5!)).toMatchObject({ upCount: 1, myDirection: null });
    expect(asAda.has(ids.s4!)).toBe(false);
    const anon = await q.selectSignalUpvotes({ db }, [ids.s1!], null);
    expect(anon.get(ids.s1!)!.myDirection).toBeNull();
    expect(JSON.stringify([...asAda.values()])).not.toMatch(
      /Ada|Grace|person/i,
    );
  });

  it('looks up display names and token symbols by id and address', async () => {
    const names = await q.selectPersonDisplayNames({ db }, [ada, grace]);
    expect(names.get(ada)).toBe('Ada Lovelace');
    expect(names.get(grace)).toBe('Grace Hopper');
    const symbols = await q.selectTokenSymbolsByAddress({ db }, [
      '0xAbC0000000000000000000000000000000000123',
      '0x0000000000000000000000000000000000000001',
    ]);
    expect(symbols.get('0xabc0000000000000000000000000000000000123')).toBe(
      'MCPIT',
    );
    expect(symbols.size).toBe(1);
  });
});
