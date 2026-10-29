/**
 * Integration tests for the campaign domain, run against a real Postgres.
 *
 *   CAMPAIGN_DB_URL=postgres://postgres:postgres@localhost:55499/regen_sydney \
 *     pnpm --filter regen-sydney test
 *
 * That must be the campaign's own database — see the README for the local
 * Postgres and Neon proxy containers. Every test creates its own members,
 * projects and round and removes them afterwards, so it is safe to run against
 * a seeded development database.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, gt, inArray } from 'drizzle-orm';
import {
  campaignCycles,
  campaignGrants,
  campaignMembers,
  campaignPayouts,
  campaignProjects,
  campaignVotes,
  db,
  type CampaignCycle,
  type CampaignMember,
} from '../../db';

import { getVotingPower, recordGrant } from '../grants';
import { getAllocations, getTally, setAllocations } from '../voting';
import {
  closeCycleAndOpenNext,
  getCycleTotals,
  getPayoutWorksheet,
  setPayoutPaid,
} from '../cycles';
import { applyPaymentEvent } from '../contributions';
import { newReference } from '../../payments/provider';

const run = `t${Date.now()}`;

let alice: CampaignMember;
let bob: CampaignMember;
let projectA: number;
let projectB: number;
let cycle: CampaignCycle;
let cycleId: number;
/**
 * Every round numbered above this one was created by the tests. Only trusted
 * once setup has finished — a half-built baseline would make teardown delete
 * rounds it did not create.
 */
let baselineCycleNumber = 0;
let baselineIsKnown = false;
/** Rounds already open before the tests, parked so ours is the only open one. */
let parkedCycleIds: number[] = [];
/** Seeded projects hidden for the duration, restored afterwards. */
let hiddenProjectIds: number[] = [];

async function makeMember(name: string): Promise<CampaignMember> {
  const [member] = await db
    .insert(campaignMembers)
    .values({
      sub: `${run}-${name}`,
      name,
      email: `${run}-${name}@example.test`,
    })
    .returning();
  return member!;
}

async function makeProject(slug: string): Promise<number> {
  const [project] = await db
    .insert(campaignProjects)
    .values({
      slug: `${run}-${slug}`,
      title: slug,
      program: 'Test',
      group: 'initiative',
      summary: 'Test project',
      active: true,
    })
    .returning();
  return project!.id;
}

beforeAll(async () => {
  // Only one round may be open at a time — the schema enforces it — so park
  // whatever the development database already has open.
  const alreadyOpen = await db.query.campaignCycles.findMany({
    where: eq(campaignCycles.status, 'open'),
  });
  parkedCycleIds = alreadyOpen.map((c) => c.id);
  if (parkedCycleIds.length > 0) {
    await db
      .update(campaignCycles)
      .set({ status: 'closed' })
      .where(inArray(campaignCycles.id, parkedCycleIds));
  }

  // Hide the seeded ballot so the tally assertions see only our two projects.
  const visible = await db.query.campaignProjects.findMany({
    where: eq(campaignProjects.active, true),
  });
  hiddenProjectIds = visible.map((p) => p.id);
  if (hiddenProjectIds.length > 0) {
    await db
      .update(campaignProjects)
      .set({ active: false })
      .where(inArray(campaignProjects.id, hiddenProjectIds));
  }

  alice = await makeMember('alice');
  bob = await makeMember('bob');
  projectA = await makeProject('project-a');
  projectB = await makeProject('project-b');

  const highest = await db.query.campaignCycles.findFirst({
    orderBy: (c, { desc }) => [desc(c.number)],
  });
  baselineCycleNumber = highest?.number ?? 0;
  baselineIsKnown = true;

  const [inserted] = await db
    .insert(campaignCycles)
    .values({
      number: baselineCycleNumber + 1,
      name: `Test round ${run}`,
      status: 'open',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationDays: 7,
      matchMultiplier: '1',
    })
    .returning();
  cycle = inserted!;
  cycleId = cycle.id;
});

afterAll(async () => {
  const memberIds = [alice, bob].filter(Boolean).map((p) => p.id);
  const projectIds = [projectA, projectB].filter(Boolean);

  // Anything numbered above the baseline is ours, including rounds a test
  // opened by closing another — so a failure part-way through still cleans up.
  const ours = baselineIsKnown
    ? await db.query.campaignCycles.findMany({
        where: gt(campaignCycles.number, baselineCycleNumber),
      })
    : [];
  const cycleIds = ours.map((c) => c.id);

  if (cycleIds.length > 0) {
    await db
      .delete(campaignPayouts)
      .where(inArray(campaignPayouts.cycleId, cycleIds));
    await db
      .delete(campaignVotes)
      .where(inArray(campaignVotes.cycleId, cycleIds));
  }
  if (memberIds.length > 0) {
    await db
      .delete(campaignGrants)
      .where(inArray(campaignGrants.memberId, memberIds));
  }
  if (cycleIds.length > 0) {
    await db.delete(campaignCycles).where(inArray(campaignCycles.id, cycleIds));
  }
  if (projectIds.length > 0) {
    await db
      .delete(campaignProjects)
      .where(inArray(campaignProjects.id, projectIds));
  }
  if (memberIds.length > 0) {
    await db
      .delete(campaignMembers)
      .where(inArray(campaignMembers.id, memberIds));
  }

  // Put the development data back the way we found it.
  if (hiddenProjectIds.length > 0) {
    await db
      .update(campaignProjects)
      .set({ active: true })
      .where(inArray(campaignProjects.id, hiddenProjectIds));
  }
  if (parkedCycleIds.length > 0) {
    await db
      .update(campaignCycles)
      .set({ status: 'open' })
      .where(inArray(campaignCycles.id, parkedCycleIds));
  }
});

describe('grants', () => {
  it('grants the joining bonus once, however many times it is replayed', async () => {
    const key = `join:${alice.id}`;
    const first = await recordGrant({
      memberId: alice.id,
      kind: 'join',
      idempotencyKey: key,
      rsut: 50,
    });
    expect(first.created).toBe(true);

    const second = await recordGrant({
      memberId: alice.id,
      kind: 'join',
      idempotencyKey: key,
      rsut: 50,
    });
    expect(second.created).toBe(false);
    expect(second.grant.id).toBe(first.grant.id);

    expect(await getVotingPower(alice.id)).toBe(50);
  });

  it('turns a settled payment into voting power, and ignores the replay', async () => {
    const event = {
      type: 'payment.completed' as const,
      providerReference: `evt-${run}`,
      reference: newReference(alice.id),
      amountCents: 12_000,
      currency: 'AUD',
      email: alice.email,
      occurredAt: new Date().toISOString(),
    };

    const first = await applyPaymentEvent(event, 'mock');
    expect(first.handled).toBe(true);
    expect(first.reason).toBeUndefined();
    expect(await getVotingPower(alice.id)).toBe(170);

    const replay = await applyPaymentEvent(event, 'mock');
    expect(replay.handled).toBe(true);
    expect(replay.reason).toBe('Already processed');
    expect(await getVotingPower(alice.id)).toBe(170);
  });

  it('ignores a payment it cannot attribute to anyone', async () => {
    const orphan = await applyPaymentEvent(
      {
        type: 'payment.completed',
        providerReference: `evt-orphan-${run}`,
        reference: 'rs_99999999_x_y',
        amountCents: 5_000,
        currency: 'AUD',
        email: null,
        occurredAt: new Date().toISOString(),
      },
      'mock',
    );
    expect(orphan.handled).toBe(false);
  });
});

describe('voting', () => {
  beforeAll(async () => {
    await recordGrant({
      memberId: bob.id,
      kind: 'contribution',
      idempotencyKey: `bob:${run}`,
      rsut: 30,
      audCents: 3_000,
      cycleId,
    });
  });

  it('refuses to spend more than the member holds', async () => {
    await expect(
      setAllocations({
        cycle,
        memberId: bob.id,
        allocations: [{ projectId: projectA, weight: 500 }],
      }),
    ).rejects.toThrow();
  });

  it('replaces the ballot rather than adding to it', async () => {
    await setAllocations({
      cycle,
      memberId: alice.id,
      allocations: [
        { projectId: projectA, weight: 100 },
        { projectId: projectB, weight: 70 },
      ],
    });
    expect(await getAllocations(cycleId, alice.id)).toEqual({
      [projectA]: 100,
      [projectB]: 70,
    });

    await setAllocations({
      cycle,
      memberId: alice.id,
      allocations: [{ projectId: projectA, weight: 170 }],
    });
    expect(await getAllocations(cycleId, alice.id)).toEqual({
      [projectA]: 170,
    });
  });

  it('tallies pro-rata and lists projects that have no votes yet', async () => {
    await setAllocations({
      cycle,
      memberId: bob.id,
      allocations: [{ projectId: projectB, weight: 30 }],
    });

    const tally = await getTally(cycle, null);

    expect(tally.rows).toHaveLength(2);
    expect(tally.totals.votesCast).toBe(200);
    expect(tally.totals.communityAud).toBe(150);
    expect(tally.totals.contributors).toBe(2);

    const a = tally.rows.find((r) => r.projectId === projectA)!;
    const b = tally.rows.find((r) => r.projectId === projectB)!;
    expect(a.votes).toBe(170);
    expect(b.votes).toBe(30);
    expect(a.share).toBeCloseTo(0.85, 5);
    expect(a.projectedAud + b.projectedAud).toBeLessThanOrEqual(
      tally.totals.potAud,
    );
  });
});

describe('rounds', () => {
  it('freezes the tally into a payout worksheet and opens the next round', async () => {
    const totals = await getCycleTotals(cycleId);
    expect(totals.contributors).toBe(2);

    const { closed, opened } = await closeCycleAndOpenNext({
      durationDays: 14,
    });
    expect(closed?.id).toBe(cycleId);
    expect(closed?.status).toBe('closed');
    expect(opened.status).toBe('open');
    expect(opened.number).toBe(cycle.number + 1);
    expect(opened.durationDays).toBe(14);

    const worksheet = await getPayoutWorksheet(cycleId);
    const rowA = worksheet.find((r) => r.projectId === projectA)!;
    const rowB = worksheet.find((r) => r.projectId === projectB)!;
    // A$150 raised, matched 1:1, split 170/30 on the votes.
    expect(rowA.amountCents).toBe(25_500);
    expect(rowB.amountCents).toBe(4_500);
    expect(rowA.paidAt).toBeNull();

    await setPayoutPaid(cycleId, projectA, true, 'bank-ref-1');
    const afterPaid = await getPayoutWorksheet(cycleId);
    expect(
      afterPaid.find((r) => r.projectId === projectA)?.paidAt,
    ).not.toBeNull();
    expect(afterPaid.find((r) => r.projectId === projectB)?.paidAt).toBeNull();
  });

  it('carries voting power into the next round but not the votes', async () => {
    const next = await db.query.campaignCycles.findFirst({
      where: eq(campaignCycles.status, 'open'),
    });
    expect(await getVotingPower(alice.id)).toBe(170);
    expect(await getAllocations(next!.id, alice.id)).toEqual({});
  });

  it('will not let a second round be open at the same time', async () => {
    await expect(
      db.insert(campaignCycles).values({
        number: 99_999,
        name: 'Should not open',
        status: 'open',
        startsAt: new Date(),
        endsAt: new Date(),
        durationDays: 7,
        matchMultiplier: '1',
      }),
    ).rejects.toThrow();
  });
});
