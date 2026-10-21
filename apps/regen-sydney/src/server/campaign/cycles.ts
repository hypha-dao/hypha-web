import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import {
  campaignCycles,
  campaignGrants,
  campaignPayouts,
  campaignProjects,
  campaignVotes,
  db,
  type CampaignCycle,
} from '../db';

import type { CycleDto } from '@rs/lib/campaign-types';

import { numeric } from './grants';

export function toCycleDto(cycle: CampaignCycle): CycleDto {
  return {
    id: cycle.id,
    number: cycle.number,
    name: cycle.name,
    status: cycle.status,
    startsAt: cycle.startsAt.toISOString(),
    endsAt: cycle.endsAt.toISOString(),
    durationDays: cycle.durationDays,
    matchMultiplier: numeric(cycle.matchMultiplier),
    closedAt: cycle.closedAt?.toISOString() ?? null,
  };
}

export async function getOpenCycle(): Promise<CampaignCycle | null> {
  const cycle = await db.query.campaignCycles.findFirst({
    where: eq(campaignCycles.status, 'open'),
  });
  return cycle ?? null;
}

/** The open round, or the most recently closed one so the page still renders. */
export async function getCurrentCycle(): Promise<CampaignCycle | null> {
  const open = await getOpenCycle();
  if (open) return open;

  const latest = await db.query.campaignCycles.findFirst({
    orderBy: (cycles, { desc }) => [desc(cycles.number)],
  });
  return latest ?? null;
}

export async function updateCycleSettings(
  cycleId: number,
  patch: { durationDays?: number; matchMultiplier?: number; name?: string },
): Promise<CampaignCycle> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.durationDays !== undefined) {
    values.durationDays = Math.max(1, Math.round(patch.durationDays));
  }
  if (patch.matchMultiplier !== undefined) {
    values.matchMultiplier = Math.max(0, patch.matchMultiplier).toFixed(3);
  }
  if (patch.name !== undefined) values.name = patch.name;

  const [updated] = await db
    .update(campaignCycles)
    .set(values)
    .where(eq(campaignCycles.id, cycleId))
    .returning();

  if (!updated) throw new Error(`Cycle ${cycleId} not found`);
  return updated;
}

/** Money raised for a round: contributions only, joining bonuses excluded. */
export async function getCycleTotals(cycleId: number): Promise<{
  communityCents: number;
  contributors: number;
}> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${campaignGrants.audCents}), 0)`,
      contributors: sql<string>`count(distinct ${campaignGrants.memberId})`,
    })
    .from(campaignGrants)
    .where(
      and(
        eq(campaignGrants.cycleId, cycleId),
        eq(campaignGrants.kind, 'contribution'),
        eq(campaignGrants.paymentStatus, 'settled'),
      ),
    );

  return {
    communityCents: numeric(row?.total),
    contributors: numeric(row?.contributors),
  };
}

/**
 * Freezes the current round's worksheet and opens the next one.
 *
 * The worksheet is written from the tally at this instant so later votes or
 * contributions cannot silently rewrite what a project was told it would get.
 * Distribution itself stays manual — these rows are a record of intent that
 * the admin ticks off as they pay.
 */
export async function closeCycleAndOpenNext(input: {
  durationDays?: number;
  name?: string;
}): Promise<{ closed: CampaignCycle | null; opened: CampaignCycle }> {
  const current = await getOpenCycle();

  const closed = current
    ? await db.transaction(async (tx) => {
        const totals = await getCycleTotals(current.id);
        const potCents = Math.round(
          totals.communityCents * (1 + numeric(current.matchMultiplier)),
        );

        const rows = await tx
          .select({
            projectId: campaignVotes.projectId,
            votes: sql<string>`coalesce(sum(${campaignVotes.weight}), 0)`,
          })
          .from(campaignVotes)
          .where(eq(campaignVotes.cycleId, current.id))
          .groupBy(campaignVotes.projectId);

        const totalVotes = rows.reduce((sum, r) => sum + numeric(r.votes), 0);

        for (const row of rows) {
          const votes = numeric(row.votes);
          const share = totalVotes > 0 ? votes / totalVotes : 0;
          await tx
            .insert(campaignPayouts)
            .values({
              cycleId: current.id,
              projectId: row.projectId,
              votes: votes.toFixed(6),
              share: share.toFixed(8),
              amountCents: Math.round(share * potCents),
            })
            .onConflictDoUpdate({
              target: [campaignPayouts.cycleId, campaignPayouts.projectId],
              set: {
                votes: votes.toFixed(6),
                share: share.toFixed(8),
                amountCents: Math.round(share * potCents),
                updatedAt: new Date(),
              },
            });
        }

        const [updated] = await tx
          .update(campaignCycles)
          .set({
            status: 'closed',
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(campaignCycles.id, current.id))
          .returning();

        return updated ?? current;
      })
    : null;

  const [{ maxNumber } = { maxNumber: 0 }] = await db
    .select({
      maxNumber: sql<number>`coalesce(max(${campaignCycles.number}), 0)`,
    })
    .from(campaignCycles);

  const nextNumber = Number(maxNumber) + 1;
  const durationDays = Math.max(
    1,
    Math.round(input.durationDays ?? closed?.durationDays ?? 21),
  );

  const [opened] = await db
    .insert(campaignCycles)
    .values({
      number: nextNumber,
      name: input.name?.trim() || `Round ${nextNumber}`,
      status: 'open',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      durationDays,
      matchMultiplier: closed?.matchMultiplier ?? '1',
    })
    .returning();

  if (!opened) throw new Error('Could not open the next round');
  return { closed, opened };
}

/** Creates the very first round if the campaign has never run one. */
export async function ensureOpenCycle(): Promise<CampaignCycle> {
  const existing = await getCurrentCycle();
  if (existing?.status === 'open') return existing;
  const { opened } = await closeCycleAndOpenNext({});
  return opened;
}

export async function getPayoutWorksheet(cycleId: number) {
  return db
    .select({
      projectId: campaignPayouts.projectId,
      title: campaignProjects.title,
      votes: campaignPayouts.votes,
      share: campaignPayouts.share,
      amountCents: campaignPayouts.amountCents,
      paidAt: campaignPayouts.paidAt,
      payoutAddress: campaignProjects.payoutAddress,
    })
    .from(campaignPayouts)
    .innerJoin(
      campaignProjects,
      eq(campaignPayouts.projectId, campaignProjects.id),
    )
    .where(eq(campaignPayouts.cycleId, cycleId))
    .orderBy(sql`${campaignPayouts.amountCents} desc`);
}

export async function setPayoutPaid(
  cycleId: number,
  projectId: number,
  paid: boolean,
  reference?: string | null,
) {
  const [updated] = await db
    .update(campaignPayouts)
    .set({
      paidAt: paid ? new Date() : null,
      paidReference: paid ? reference ?? null : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaignPayouts.cycleId, cycleId),
        eq(campaignPayouts.projectId, projectId),
      ),
    )
    .returning();

  if (!updated) throw new Error('That project is not on this round worksheet');
  return updated;
}
