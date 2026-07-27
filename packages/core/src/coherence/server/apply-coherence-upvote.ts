import { after } from 'next/server';

import type { DbConfig } from '../../server';
import type { CoherenceUpvoteSummary } from '../types';
import {
  EMPTY_COHERENCE_UPVOTE_SUMMARY,
  findCoherenceUpvoteSummaries,
  removeCoherenceUpvote,
  upsertCoherenceUpvote,
} from './coherence-upvotes';
import { getMemberVotingPower } from './web3/get-member-voting-power';
import { recordSignalUpvoteOnChain } from './web3/record-signal-upvote-onchain';

/** The signal being voted on, joined with its space's on-chain id. */
export type CoherenceUpvoteTarget = {
  id: number;
  spaceId: number | null;
  archived: boolean | null;
  web3SpaceId: number | null;
};

/** Whoever the vote is attributed to, already resolved and authorized. */
export type CoherenceUpvoteActor = {
  id: number;
  address?: string | null;
};

/**
 * Mirror to the Signals contract once the response is on its way. Outside a
 * request scope (scripts, tests) `after` is unavailable, so fall back to a
 * detached call — either way the mirror is best-effort.
 */
function scheduleUpvoteMirror(
  event: Parameters<typeof recordSignalUpvoteOnChain>[0],
) {
  try {
    after(() => recordSignalUpvoteOnChain(event));
  } catch {
    void recordSignalUpvoteOnChain(event);
  }
}

/** Clamp to 1..100; missing or non-numeric input means "use my full power". */
export function resolveVotingPowerPercent(raw: unknown): number {
  const parsed = Number(raw);
  return Math.min(
    100,
    Math.max(1, Number.isFinite(parsed) ? Math.trunc(parsed) : 100),
  );
}

export async function getCoherenceUpvoteSummary(
  {
    coherenceId,
    viewerPersonId,
  }: { coherenceId: number; viewerPersonId: number },
  { db }: DbConfig,
): Promise<CoherenceUpvoteSummary> {
  const summaries = await findCoherenceUpvoteSummaries(
    { coherenceIds: [coherenceId], viewerPersonId },
    { db },
  );
  return summaries[coherenceId] ?? EMPTY_COHERENCE_UPVOTE_SUMMARY;
}

/**
 * Record an upvote weighted by a share of the actor's on-chain voting power.
 *
 * Shared by the signed-in UI path and the community-app API path so both read
 * voting power from the space's on-chain source — an integration can allocate
 * a percentage of what a member actually holds, never more. Callers are
 * responsible for authorizing the actor first.
 */
export async function applyCoherenceUpvote(
  {
    coherence,
    actor,
    votingPowerPercent,
  }: {
    coherence: CoherenceUpvoteTarget;
    actor: CoherenceUpvoteActor;
    votingPowerPercent?: number;
  },
  { db }: DbConfig,
): Promise<CoherenceUpvoteSummary> {
  if (coherence.archived) {
    throw new Error('Cannot vote on an archived signal');
  }
  if (coherence.spaceId == null || coherence.web3SpaceId == null) {
    throw new Error('Signal space is not linked to an on-chain space');
  }
  if (!actor.address) {
    throw new Error('A linked wallet is required to vote on signals');
  }

  const percent = resolveVotingPowerPercent(votingPowerPercent);
  const voter = actor.address as `0x${string}`;
  const web3SpaceId = coherence.web3SpaceId;

  const { votingPower: maxVotingPower, tokenDecimals } =
    await getMemberVotingPower({ memberAddress: voter, web3SpaceId });
  if (maxVotingPower <= 0n) {
    throw new Error('You have no voting power in this space');
  }

  let votingPower = (maxVotingPower * BigInt(percent)) / 100n;
  if (votingPower <= 0n) {
    votingPower = 1n;
  }

  await upsertCoherenceUpvote(
    {
      coherenceId: coherence.id,
      personId: actor.id,
      votingPower: votingPower.toString(),
      maxVotingPower: maxVotingPower.toString(),
      tokenDecimals,
    },
    { db },
  );

  scheduleUpvoteMirror({
    web3SpaceId,
    signalId: coherence.id,
    voter,
    amount: votingPower,
    kind: 'upvote',
  });

  return getCoherenceUpvoteSummary(
    { coherenceId: coherence.id, viewerPersonId: actor.id },
    { db },
  );
}

/** Remove the actor's own upvote. Callers must authorize the actor first. */
export async function applyCoherenceUpvoteRemoval(
  {
    coherence,
    actor,
  }: { coherence: CoherenceUpvoteTarget; actor: CoherenceUpvoteActor },
  { db }: DbConfig,
): Promise<CoherenceUpvoteSummary> {
  const removed = await removeCoherenceUpvote(
    { coherenceId: coherence.id, personId: actor.id },
    { db },
  );

  // A no-op removal (e.g. a double click) should not emit a removal event.
  if (removed && coherence.web3SpaceId != null && actor.address) {
    scheduleUpvoteMirror({
      web3SpaceId: coherence.web3SpaceId,
      signalId: coherence.id,
      voter: actor.address as `0x${string}`,
      kind: 'removal',
    });
  }

  return getCoherenceUpvoteSummary(
    { coherenceId: coherence.id, viewerPersonId: actor.id },
    { db },
  );
}
