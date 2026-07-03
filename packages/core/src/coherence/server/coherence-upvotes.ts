import {
  coherenceUpvotes,
  coherences,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import { DbConfig } from '../../server';
import type { CoherenceUpvoteSummary, CoherenceUpvoter } from '../types';

const MAX_VOTERS_PER_SUMMARY = 12;

export const EMPTY_COHERENCE_UPVOTE_SUMMARY: CoherenceUpvoteSummary = {
  totalVotingPower: '0',
  upvoteCount: 0,
  tokenDecimals: 0,
  voters: [],
  myUpvote: null,
};

/** Coherence row with the space link needed to resolve on-chain voting power. */
export const findCoherenceForUpvote = async (
  { slug }: { slug: string },
  { db }: DbConfig,
) => {
  const [row] = await db
    .select({
      id: coherences.id,
      spaceId: coherences.spaceId,
      archived: coherences.archived,
      web3SpaceId: spaces.web3SpaceId,
    })
    .from(coherences)
    .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
    .where(eq(coherences.slug, slug))
    .limit(1);
  return row ?? null;
};

/**
 * Aggregates upvotes for a set of coherences: total voting power, voter list
 * (highest power first) and, when a viewer is given, their own upvote.
 */
export const findCoherenceUpvoteSummaries = async (
  {
    coherenceIds,
    viewerPersonId,
  }: { coherenceIds: number[]; viewerPersonId?: number | null },
  { db }: DbConfig,
): Promise<Record<number, CoherenceUpvoteSummary>> => {
  if (coherenceIds.length === 0) return {};

  const rows = await db
    .select({
      coherenceId: coherenceUpvotes.coherenceId,
      personId: coherenceUpvotes.personId,
      votingPower: coherenceUpvotes.votingPower,
      maxVotingPower: coherenceUpvotes.maxVotingPower,
      tokenDecimals: coherenceUpvotes.tokenDecimals,
      name: people.name,
      surname: people.surname,
      avatarUrl: people.avatarUrl,
    })
    .from(coherenceUpvotes)
    .innerJoin(people, eq(coherenceUpvotes.personId, people.id))
    .where(inArray(coherenceUpvotes.coherenceId, coherenceIds));

  const summaries: Record<number, CoherenceUpvoteSummary> = {};
  const totals = new Map<number, bigint>();

  for (const row of rows) {
    const summary = (summaries[row.coherenceId] ??= {
      ...EMPTY_COHERENCE_UPVOTE_SUMMARY,
      voters: [],
    });
    let power: bigint;
    try {
      power = BigInt(row.votingPower);
    } catch {
      power = 0n;
    }
    totals.set(row.coherenceId, (totals.get(row.coherenceId) ?? 0n) + power);
    summary.upvoteCount += 1;
    summary.tokenDecimals = Math.max(summary.tokenDecimals, row.tokenDecimals);
    const voter: CoherenceUpvoter = {
      personId: row.personId,
      name: [row.name, row.surname].filter(Boolean).join(' ').trim() || null,
      avatarUrl: row.avatarUrl,
      votingPower: power.toString(),
    };
    summary.voters.push(voter);
    if (viewerPersonId != null && row.personId === viewerPersonId) {
      summary.myUpvote = {
        votingPower: row.votingPower,
        maxVotingPower: row.maxVotingPower,
      };
    }
  }

  for (const [coherenceId, summary] of Object.entries(summaries)) {
    summary.totalVotingPower = (
      totals.get(Number(coherenceId)) ?? 0n
    ).toString();
    summary.voters.sort((a, b) => {
      const diff = BigInt(b.votingPower) - BigInt(a.votingPower);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    summary.voters = summary.voters.slice(0, MAX_VOTERS_PER_SUMMARY);
  }

  return summaries;
};

export const upsertCoherenceUpvote = async (
  {
    coherenceId,
    personId,
    votingPower,
    maxVotingPower,
    tokenDecimals,
  }: {
    coherenceId: number;
    personId: number;
    votingPower: string;
    maxVotingPower: string;
    tokenDecimals: number;
  },
  { db }: DbConfig,
) => {
  await db
    .insert(coherenceUpvotes)
    .values({
      coherenceId,
      personId,
      votingPower,
      maxVotingPower,
      tokenDecimals,
    })
    .onConflictDoUpdate({
      target: [coherenceUpvotes.coherenceId, coherenceUpvotes.personId],
      set: {
        votingPower,
        maxVotingPower,
        tokenDecimals,
        updatedAt: new Date(),
      },
    });
};

export const removeCoherenceUpvote = async (
  { coherenceId, personId }: { coherenceId: number; personId: number },
  { db }: DbConfig,
) => {
  await db
    .delete(coherenceUpvotes)
    .where(
      and(
        eq(coherenceUpvotes.coherenceId, coherenceId),
        eq(coherenceUpvotes.personId, personId),
      ),
    );
};
