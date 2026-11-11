import {
  coherenceUpvotes,
  coherences,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import { DbConfig } from '../../server';
import {
  aggregateCoherenceUpvoteSummaries,
  emptyCoherenceUpvoteSummary,
  signalVoteDirection,
} from '../coherence-upvote-summary';
import type { CoherenceUpvoteSummary, SignalVoteDirection } from '../types';

export { emptyCoherenceUpvoteSummary };

export const EMPTY_COHERENCE_UPVOTE_SUMMARY: CoherenceUpvoteSummary = {
  totalVotingPower: '0',
  upvoteCount: 0,
  downvoteCount: 0,
  netVoteCount: 0,
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
      direction: coherenceUpvotes.direction,
      createdAt: coherenceUpvotes.createdAt,
      updatedAt: coherenceUpvotes.updatedAt,
      name: people.name,
      surname: people.surname,
      avatarUrl: people.avatarUrl,
    })
    .from(coherenceUpvotes)
    .innerJoin(people, eq(coherenceUpvotes.personId, people.id))
    .where(inArray(coherenceUpvotes.coherenceId, coherenceIds));

  return aggregateCoherenceUpvoteSummaries({
    coherenceIds,
    rows,
    viewerPersonId,
  });
};

/**
 * Insert or replace this person's one vote.
 * @returns the direction stored before this write, or null for a new vote.
 */
export const upsertCoherenceUpvote = async (
  {
    coherenceId,
    personId,
    votingPower,
    maxVotingPower,
    tokenDecimals,
    direction,
  }: {
    coherenceId: number;
    personId: number;
    votingPower: string;
    maxVotingPower: string;
    tokenDecimals: number;
    direction: SignalVoteDirection;
  },
  { db }: DbConfig,
): Promise<SignalVoteDirection | null> => {
  const [existing] = await db
    .select({ direction: coherenceUpvotes.direction })
    .from(coherenceUpvotes)
    .where(
      and(
        eq(coherenceUpvotes.coherenceId, coherenceId),
        eq(coherenceUpvotes.personId, personId),
      ),
    )
    .limit(1);

  await db
    .insert(coherenceUpvotes)
    .values({
      coherenceId,
      personId,
      votingPower,
      maxVotingPower,
      tokenDecimals,
      direction,
    })
    .onConflictDoUpdate({
      target: [coherenceUpvotes.coherenceId, coherenceUpvotes.personId],
      set: {
        votingPower,
        maxVotingPower,
        tokenDecimals,
        direction,
        updatedAt: new Date(),
      },
    });

  return existing ? signalVoteDirection(existing.direction) : null;
};

/** @returns the removed direction, or null when there was no row. */
export const removeCoherenceUpvote = async (
  { coherenceId, personId }: { coherenceId: number; personId: number },
  { db }: DbConfig,
): Promise<SignalVoteDirection | null> => {
  const deleted = await db
    .delete(coherenceUpvotes)
    .where(
      and(
        eq(coherenceUpvotes.coherenceId, coherenceId),
        eq(coherenceUpvotes.personId, personId),
      ),
    )
    .returning();
  const row = deleted[0];
  return row ? signalVoteDirection(row.direction) : null;
};
