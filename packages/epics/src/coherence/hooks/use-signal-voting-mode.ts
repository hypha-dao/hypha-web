'use client';

import {
  signalVotingModeForSource,
  useSpaceDetailsWeb3Rpc,
  type SignalVotingMode,
} from '@hypha-platform/core/client';

/** How members upvote signals in this space, read from its on-chain voting method. */
export function useSignalVotingMode(
  web3SpaceId?: number | null,
): SignalVotingMode {
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId ?? null,
  });
  return signalVotingModeForSource(spaceDetails?.votingPowerSource);
}
