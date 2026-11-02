/** Voting power source id of SpaceVotingPower: one member, one vote. */
export const ONE_MEMBER_ONE_VOTE_SOURCE = 2;

export type SignalVotingMode = 'token' | 'one-member-one-vote';

/** `null` while the space's voting power source is still unknown. */
export function signalVotingModeForSource(
  votingPowerSource: number | bigint | null | undefined,
): SignalVotingMode | null {
  if (votingPowerSource == null) return null;
  return Number(votingPowerSource) === ONE_MEMBER_ONE_VOTE_SOURCE
    ? 'one-member-one-vote'
    : 'token';
}
