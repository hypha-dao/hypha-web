import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Real-database check of what `hypha_list_quests` reads: the quest listing (filters, counts,
 * paging and the parts of the page's quests only) and the lookup of the documents quests
 * point to. Runs only when a database URL is set (`BRANCH_DB_URL` or `DEFAULT_DB_URL`); use a
 * throwaway database that has run the migrations. It creates its own rows (slugs prefixed
 * `mcp-quest-`) and deletes them afterwards. It also proves that the read writes nothing.
 */
vi.mock('server-only', () => ({}));
vi.setConfig({ testTimeout: 90_000, hookTimeout: 400_000 });

const HAS_DB = Boolean(process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL);
const PREFIX = `mcp-quest-${Date.now()}`;

describe.skipIf(!HAS_DB)('quests queries (database)', () => {
  let db: typeof import('@hypha-platform/storage-postgres')['db'];
  let tables: typeof import('@hypha-platform/storage-postgres');
  let read: typeof import('../../space-quests/server/list-quests-read');
  let spaceId: number;
  let otherSpaceId: number;
  let ada: number;
  let grace: number;
  let ownDocId: number;
  let foreignDocId: number;
  let proposedId: number;
  const slugs = (items: { slug: string }[]) =>
    items.map((item) => item.slug.replace(`${PREFIX}-`, ''));
  const list = (over: Record<string, unknown> = {}) =>
    read.readQuestsListing({ db }, {
      spaceId,
      offset: 0,
      limit: 20,
      ...over,
    } as never);

  beforeAll(async () => {
    tables = await import('@hypha-platform/storage-postgres');
    read = await import('../../space-quests/server/list-quests-read');
    db = tables.db;
    const mkSpace = async (slug: string) =>
      (
        await db
          .insert(tables.spaces)
          .values({ title: slug, slug } as never)
          .returning({ id: tables.spaces.id })
      )[0]!.id;
    spaceId = await mkSpace(`${PREFIX}-a`);
    otherSpaceId = await mkSpace(`${PREFIX}-b`);
    const mkPerson = async (name: string) =>
      (
        await db
          .insert(tables.people)
          .values({
            sub: `${PREFIX}-${name}`,
            slug: `${PREFIX}-${name}`,
            name,
            surname: 'Tester',
          } as never)
          .returning({ id: tables.people.id })
      )[0]!.id;
    ada = await mkPerson('Ada');
    grace = await mkPerson('Grace');
    const mkDoc = async (slug: string, sid: number) =>
      (
        await db
          .insert(tables.documents)
          .values({
            creatorId: ada,
            spaceId: sid,
            title: slug,
            slug,
            state: 'proposal',
            label: 'Quest',
            web3ProposalId: 1_000_000 + Math.floor(Math.random() * 1_000),
          } as never)
          .returning({ id: tables.documents.id })
      )[0]!.id;
    ownDocId = await mkDoc(`${PREFIX}-doc`, spaceId);
    foreignDocId = await mkDoc(`${PREFIX}-foreign-doc`, otherSpaceId);

    const mkQuest = async (
      slug: string,
      over: Record<string, unknown>,
      sid = spaceId,
    ) =>
      (
        await db
          .insert(tables.spaceQuests)
          .values({
            spaceId: sid,
            slug: `${PREFIX}-${slug}`,
            name: `Quest ${slug}`,
            goal: 'A goal',
            ...over,
          } as never)
          .returning({ id: tables.spaceQuests.id })
      )[0]!.id;
    const t = (n: number) => new Date(Date.UTC(2026, 0, n));
    proposedId = await mkQuest('proposed', {
      status: 'proposed',
      proposalDocumentId: ownDocId,
      leadPersonId: ada,
      leadName: 'Ada Tester (you)',
      updatedAt: t(1),
    });
    const activeId = await mkQuest('active', {
      status: 'active',
      targetDate: '2099-01-01',
      leadPersonId: ada,
      leadName: 'Ada Tester',
      proposalDocumentId: foreignDocId, // a link into another space
      rewards: [{ amount: '10', token: 'USDC' }],
      scopeIn: ['beds', 'soil'],
      updatedAt: t(2),
    });
    await mkQuest('paused', {
      status: 'paused',
      leadPersonId: grace,
      leadName: 'Grace Tester',
      healthState: 'at_risk',
      healthMarker: 40,
      healthSummary: 'Waiting for seeds',
      updatedAt: t(3),
    });
    const memberOnlyId = await mkQuest('member', {
      status: 'completed',
      leadPersonId: grace,
      leadName: 'Grace Tester',
      updatedAt: t(4),
    });
    await mkQuest('archived', { status: 'archived', updatedAt: t(5) });
    await mkQuest('other', { status: 'active' }, otherSpaceId);

    await db.insert(tables.spaceQuestMilestones).values([
      {
        questId: activeId,
        order: 2,
        name: 'Plant',
        status: 'not_started',
        dueDate: '2099-02-01',
      },
      {
        questId: activeId,
        order: 1,
        name: 'Dig',
        description: 'Dig the beds',
        status: 'in_progress',
        dueDate: '2099-01-15',
      },
    ] as never);
    await db.insert(tables.spaceQuestMembers).values([
      {
        questId: activeId,
        personId: ada,
        memberName: 'Ada Tester',
        roleLabel: 'Lead',
        responsibilities: ['Plan'],
        order: 1,
      },
      {
        questId: memberOnlyId,
        personId: ada,
        memberName: 'Ada Tester',
        responsibilities: [],
        order: 1,
      },
    ] as never);
    await db.insert(tables.spaceQuestDeliverables).values({
      questId: activeId,
      name: 'Plan',
      url: 'https://example.org/plan',
      order: 1,
    } as never);
    const now = Date.now();
    await db.insert(tables.spaceQuestUpdates).values([
      {
        questId: activeId,
        authorName: 'Ada Tester',
        text: 'private chatter one',
        createdAt: new Date(now - 86_400_000),
      },
      {
        questId: activeId,
        authorName: 'Ada Tester',
        text: 'private chatter two',
        createdAt: new Date(now - 20 * 86_400_000),
      },
    ] as never);
    // an author-private draft in the same space: never part of a quest list
    await db.insert(tables.spaceQuestDrafts).values({
      spaceId,
      authorPersonId: ada,
      name: `${PREFIX}-draft`,
      payload: { name: `${PREFIX}-draft-secret` },
    } as never);
  });

  afterAll(async () => {
    if (!HAS_DB || !tables) return;
    const { like } = await import('drizzle-orm');
    await db
      .delete(tables.spaceQuestDrafts)
      .where(like(tables.spaceQuestDrafts.name, `${PREFIX}%`));
    await db
      .delete(tables.spaceQuests)
      .where(like(tables.spaceQuests.slug, `${PREFIX}%`));
    await db
      .delete(tables.documents)
      .where(like(tables.documents.slug, `${PREFIX}%`));
    await db
      .delete(tables.people)
      .where(like(tables.people.slug, `${PREFIX}%`));
    await db
      .delete(tables.spaces)
      .where(like(tables.spaces.slug, `${PREFIX}%`));
  });

  it('lists the quests of the space, newest first, without archived, drafts or other spaces', async () => {
    const r = await list();
    // the quest with the latest update comes first, then by the quest's own change time
    expect(slugs(r.items)).toEqual(['active', 'member', 'paused', 'proposed']);
    expect(r.total).toBe(4);
    expect(r.counts).toEqual({
      active: 1,
      proposed: 1,
      paused: 1,
      completed: 1,
      archived: 1,
    });
    expect(JSON.stringify(r)).not.toContain('draft-secret');
    expect(slugs((await list({ includeArchived: true })).items)).toContain(
      'archived',
    );
    expect((await list({ includeArchived: true })).total).toBe(5);
  });

  it('filters by stored status and by mine (lead or member), and the counts follow mine only', async () => {
    expect(slugs((await list({ status: 'active' })).items)).toEqual(['active']);
    expect((await list({ status: 'active' })).total).toBe(1);
    expect(slugs((await list({ status: 'archived' })).items)).toEqual([
      'archived',
    ]);
    const mine = await list({ mineOfPersonId: ada });
    // lead of proposed and active, plain member of the completed one; not the paused one
    expect(slugs(mine.items)).toEqual(['active', 'member', 'proposed']);
    expect(mine.total).toBe(3);
    expect(mine.counts).toEqual({
      active: 1,
      proposed: 1,
      paused: 0,
      completed: 1,
      archived: 0,
    });
    expect(slugs((await list({ mineOfPersonId: grace })).items)).toEqual([
      'member',
      'paused',
    ]);
  });

  it('pages after the filters with a stable order', async () => {
    const first = await list({ offset: 0, limit: 2 });
    const second = await list({ offset: 2, limit: 2 });
    expect([...slugs(first.items), ...slugs(second.items)]).toEqual([
      'active',
      'member',
      'paused',
      'proposed',
    ]);
    expect(first.total).toBe(4);
    expect(second.total).toBe(4);
  });

  it('loads the parts of the page only, in order, and no update text', async () => {
    const onlyActive = await list({ status: 'active' });
    const active = onlyActive.items[0]!;
    expect(active.milestones.map((m) => m.name)).toEqual(['Dig', 'Plant']);
    expect(active.members.map((m) => m.memberName)).toEqual(['Ada Tester']);
    expect(active.members[0]!.isLead).toBe(true);
    expect(active.deliverables.map((d) => d.name)).toEqual(['Plan']);
    expect(active.rewards).toEqual([{ amount: '10', token: 'USDC' }]);
    expect(active.scopeInMarkdown).toBe('- beds\n- soil');
    expect(JSON.stringify(onlyActive)).not.toContain('private chatter');
    // a page that does not contain a quest does not carry its parts
    const other = await list({ status: 'paused' });
    expect(other.items[0]!.milestones).toEqual([]);
  });

  it('health: computed for an active quest, stored for the others, update counts by aggregate', async () => {
    const active = (await list({ status: 'active' })).items[0]!;
    expect(active.health).toMatchObject({
      state: 'on_track',
      marker: 80,
      summary: '',
      updatesThisWeek: 1,
    });
    expect(active.health.lastUpdateAt).toBeTruthy();
    expect(active.health.daysToTarget).toBeGreaterThan(100);
    const paused = (await list({ status: 'paused' })).items[0]!;
    expect(paused.health).toMatchObject({
      state: 'at_risk',
      marker: 40,
      summary: 'Waiting for seeds',
      updatesThisWeek: 0,
      lastUpdateAt: null,
    });
    const completed = (await list({ status: 'completed' })).items[0]!;
    expect(completed.health.marker).toBe(100);
  });

  it('names carry no viewer marker', async () => {
    const proposed = (await list({ status: 'proposed' })).items[0]!;
    expect(proposed.leadName).toBe('Ada Tester');
  });

  it('reading writes nothing: a proposed quest stays proposed and no room is opened', async () => {
    const { eq } = await import('drizzle-orm');
    const snapshot = async () =>
      (
        await db
          .select()
          .from(tables.spaceQuests)
          .where(eq(tables.spaceQuests.id, proposedId))
      )[0]!;
    const before = await snapshot();
    await list();
    await list({ mineOfPersonId: ada });
    const after = await snapshot();
    expect(after.status).toBe('proposed');
    expect(after.chatRoomId).toBe(before.chatRoomId);
    expect(after.acceptedAt).toBe(before.acceptedAt);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it('the document lookup says which space each linked document belongs to', async () => {
    const { selectQuestProposalDocuments } = await import(
      '../../space-quests/server/list-quests-queries'
    );
    const found = await selectQuestProposalDocuments({ db }, [
      ownDocId,
      foreignDocId,
      2_000_000_000,
    ]);
    expect(found.get(ownDocId)).toMatchObject({
      spaceId,
      slug: `${PREFIX}-doc`,
    });
    expect(found.get(foreignDocId)).toMatchObject({ spaceId: otherSpaceId });
    expect(found.has(2_000_000_000)).toBe(false);
    expect((await selectQuestProposalDocuments({ db }, [])).size).toBe(0);
  });
});
