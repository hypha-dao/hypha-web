import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  campaignCycles,
  campaignProjects,
  campaignVotes,
  db,
  type CampaignCycle,
} from '../db';

import type { TallyRowDto } from '@rs/lib/campaign-types';

import { getVotingPower, numeric } from './grants';
import { getCycleTotals } from './cycles';

/**
 * Voting is linear and token-weighted: a member spreads their RSUT across as
 * many projects as they like, and the pot is split pro-rata by vote share.
 * Weight comes from the grants ledger, not from `balanceOf`, so RSUT's decay
 * and any transfers out do not quietly change someone's say.
 */

export class VotingError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'VotingError';
  }
}

export type Allocation = { projectId: number; weight: number };

export async function getAllocations(
  cycleId: number,
  memberId: number,
): Promise<Record<number, number>> {
  const rows = await db
    .select({
      projectId: campaignVotes.projectId,
      weight: campaignVotes.weight,
    })
    .from(campaignVotes)
    .where(
      and(
        eq(campaignVotes.cycleId, cycleId),
        eq(campaignVotes.memberId, memberId),
      ),
    );

  return Object.fromEntries(
    rows
      .map((row) => [row.projectId, numeric(row.weight)] as const)
      .filter(([, weight]) => weight > 0),
  );
}

/**
 * Replaces a member's whole ballot for the round in one transaction. Sending
 * the complete allocation rather than deltas means a dropped request can never
 * leave a half-applied ballot behind.
 */
export async function setAllocations(input: {
  cycle: CampaignCycle;
  memberId: number;
  allocations: Allocation[];
}): Promise<Record<number, number>> {
  const { cycle, memberId } = input;

  if (cycle.status !== 'open') {
    throw new VotingError(409, 'This round has closed');
  }
  if (cycle.endsAt.getTime() < Date.now()) {
    throw new VotingError(409, 'Voting for this round has ended');
  }

  const cleaned = input.allocations
    .map((entry) => ({
      projectId: Number(entry.projectId),
      weight: Math.max(0, Math.round(Number(entry.weight) * 1e6) / 1e6),
    }))
    .filter((entry) => Number.isInteger(entry.projectId) && entry.weight > 0);

  const seen = new Set<number>();
  for (const entry of cleaned) {
    if (seen.has(entry.projectId)) {
      throw new VotingError(400, 'Duplicate project in allocation');
    }
    seen.add(entry.projectId);
  }

  const power = await getVotingPower(memberId);
  const total = cleaned.reduce((sum, entry) => sum + entry.weight, 0);
  // A cent of slack absorbs float noise from the browser without letting
  // anyone meaningfully overspend.
  if (total > power + 0.000001) {
    throw new VotingError(
      400,
      `You only have ${power} RSUT to allocate, but tried to allocate ${total}`,
    );
  }

  if (cleaned.length > 0) {
    const projectIds = cleaned.map((entry) => entry.projectId);
    const valid = await db
      .select({ id: campaignProjects.id })
      .from(campaignProjects)
      .where(
        and(
          inArray(campaignProjects.id, projectIds),
          eq(campaignProjects.active, true),
        ),
      );
    if (valid.length !== projectIds.length) {
      throw new VotingError(400, 'One of those projects is not on the ballot');
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(campaignVotes)
      .where(
        and(
          eq(campaignVotes.cycleId, cycle.id),
          eq(campaignVotes.memberId, memberId),
        ),
      );

    if (cleaned.length > 0) {
      await tx.insert(campaignVotes).values(
        cleaned.map((entry) => ({
          cycleId: cycle.id,
          memberId,
          projectId: entry.projectId,
          weight: entry.weight.toFixed(6),
        })),
      );
    }
  });

  return Object.fromEntries(
    cleaned.map((entry) => [entry.projectId, entry.weight]),
  );
}

export type Tally = {
  rows: TallyRowDto[];
  totals: {
    communityAud: number;
    matchAud: number;
    potAud: number;
    contributors: number;
    votesCast: number;
  };
};

/**
 * Live tally for a round. `memberId` narrows the `yourVotes` column; the
 * public shape is identical so an anonymous visitor sees the same standings.
 */
export async function getTally(
  cycle: CampaignCycle,
  memberId?: number | null,
): Promise<Tally> {
  const [totalsRow, perProject, mine] = await Promise.all([
    getCycleTotals(cycle.id),
    // Left join from projects, so a project that nobody has voted for yet
    // still appears on the ballot with a zero.
    db
      .select({
        projectId: campaignProjects.id,
        votes: sql<string>`coalesce(sum(case when ${campaignVotes.cycleId} = ${cycle.id} then ${campaignVotes.weight} else 0 end), 0)`,
      })
      .from(campaignProjects)
      .leftJoin(
        campaignVotes,
        and(
          eq(campaignVotes.projectId, campaignProjects.id),
          eq(campaignVotes.cycleId, cycle.id),
        ),
      )
      .where(eq(campaignProjects.active, true))
      .groupBy(campaignProjects.id),
    memberId
      ? getAllocations(cycle.id, memberId)
      : Promise.resolve({} as Record<number, number>),
  ]);

  const match = numeric(cycle.matchMultiplier);
  const communityAud = totalsRow.communityCents / 100;
  const matchAud = communityAud * match;
  const potAud = communityAud + matchAud;

  const totalVotes = perProject.reduce(
    (sum, row) => sum + numeric(row.votes),
    0,
  );

  const rows: TallyRowDto[] = perProject
    .map((row) => {
      const votes = numeric(row.votes);
      const share = totalVotes > 0 ? votes / totalVotes : 0;
      return {
        projectId: row.projectId,
        votes,
        yourVotes: mine[row.projectId] ?? 0,
        share,
        projectedAud: Math.round(share * potAud),
      };
    })
    .sort((a, b) => b.votes - a.votes);

  return {
    rows,
    totals: {
      communityAud,
      matchAud,
      potAud,
      contributors: totalsRow.contributors,
      votesCast: totalVotes,
    },
  };
}

/** Drops a removed project's votes so they cannot skew a later tally. */
export async function clearVotesForProject(projectId: number) {
  await db.delete(campaignVotes).where(eq(campaignVotes.projectId, projectId));
}

export async function getOpenCycleOrThrow(): Promise<CampaignCycle> {
  const cycle = await db.query.campaignCycles.findFirst({
    where: eq(campaignCycles.status, 'open'),
  });
  if (!cycle) throw new VotingError(409, 'No round is open for voting');
  return cycle;
}
