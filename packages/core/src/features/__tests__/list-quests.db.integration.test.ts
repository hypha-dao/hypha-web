import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Real-database check of what `hypha_list_quests` reads: the plain quest list and the lookup
 * of the documents quests point to. Runs only when a database URL is set (`BRANCH_DB_URL` or
 * `DEFAULT_DB_URL`); use a throwaway database that has run the migrations. It creates its own
 * rows (slugs prefixed `mcp-quest-`) and deletes them afterwards. It also proves that the read
 * writes nothing: a proposed quest whose proposal is accepted stays proposed.
 */
vi.mock('server-only', () => ({}));
vi.setConfig({ testTimeout: 90_000, hookTimeout: 400_000 });

const HAS_DB = Boolean(process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL);
const PREFIX = `mcp-quest-${Date.now()}`;

describe.skipIf(!HAS_DB)('quests queries (database)', () => {
  let db: typeof import('@hypha-platform/storage-postgres')['db'];
  let tables: typeof import('@hypha-platform/storage-postgres');
  let spaceId: number;
  let otherSpaceId: number;
  let personId: number;
  let ownDocId: number;
  let foreignDocId: number;
  let proposedId: number;

  beforeAll(async () => {
    tables = await import('@hypha-platform/storage-postgres');
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
    personId = (
      await db
        .insert(tables.people)
        .values({
          sub: `${PREFIX}-p`,
          slug: `${PREFIX}-p`,
          name: 'Ada',
          surname: 'Lovelace',
        } as never)
        .returning({ id: tables.people.id })
    )[0]!.id;
    const mkDoc = async (slug: string, sid: number) =>
      (
        await db
          .insert(tables.documents)
          .values({
            creatorId: personId,
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
    proposedId = await mkQuest('proposed', {
      status: 'proposed',
      proposalDocumentId: ownDocId,
      leadPersonId: personId,
      leadName: 'Ada Lovelace',
    });
    const activeId = await mkQuest('active', {
      status: 'active',
      targetDate: '2099-01-01',
      leadPersonId: personId,
      leadName: 'Ada Lovelace',
      proposalDocumentId: foreignDocId, // a link into another space
      rewards: [{ amount: '10', token: 'USDC' }],
    });
    await mkQuest('other', { status: 'active' }, otherSpaceId);
    await db.insert(tables.spaceQuestMilestones).values({
      questId: activeId,
      order: 1,
      name: 'Dig',
      description: 'Dig the beds',
      status: 'in_progress',
    } as never);
    await db.insert(tables.spaceQuestMembers).values({
      questId: activeId,
      personId,
      memberName: 'Ada Lovelace',
      roleLabel: 'Lead',
      responsibilities: ['Plan'],
      order: 1,
    } as never);
    await db.insert(tables.spaceQuestDeliverables).values({
      questId: activeId,
      name: 'Plan',
      url: 'https://example.org/plan',
      order: 1,
    } as never);
    // an author-private draft in the same space: never part of a quest list
    await db.insert(tables.spaceQuestDrafts).values({
      spaceId,
      authorPersonId: personId,
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

  it('the plain list returns the quests of the space with their parts, no draft, nothing of another space', async () => {
    const { listSpaceQuests } = await import(
      '../../space-quests/server/queries'
    );
    const overview = await listSpaceQuests(
      { spaceSlug: `${PREFIX}-a` },
      { db },
    );
    const slugs = overview!.quests.map((quest) => quest.slug).sort();
    expect(slugs).toEqual([`${PREFIX}-active`, `${PREFIX}-proposed`]);
    const active = overview!.quests.find((q) => q.slug.endsWith('-active'))!;
    expect(active.milestones.map((m) => m.name)).toEqual(['Dig']);
    expect(active.members.map((m) => m.memberName)).toEqual(['Ada Lovelace']);
    expect(active.deliverables.map((d) => d.name)).toEqual(['Plan']);
    expect(active.rewards).toEqual([{ amount: '10', token: 'USDC' }]);
    expect(JSON.stringify(overview)).not.toContain('draft-secret');
  });

  it('reading writes nothing: a proposed quest stays proposed and no room is opened', async () => {
    const { listSpaceQuests } = await import(
      '../../space-quests/server/queries'
    );
    const { eq } = await import('drizzle-orm');
    const snapshot = async () =>
      (
        await db
          .select()
          .from(tables.spaceQuests)
          .where(eq(tables.spaceQuests.id, proposedId))
      )[0]!;
    const before = await snapshot();
    await listSpaceQuests({ spaceSlug: `${PREFIX}-a` }, { db });
    await listSpaceQuests({ spaceSlug: `${PREFIX}-a` }, { db });
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
