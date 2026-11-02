'use client';

import React from 'react';
import {
  signalVotingModeForSource,
  useSpaceDetailsWeb3Rpc,
  type SignalVotingMode,
} from '@hypha-platform/core/client';

export type SignalVotingModeState = {
  /** `null` until the space details resolve, so callers never guess a mode. */
  votingMode: SignalVotingMode | null;
  isLoading: boolean;
  /** Space details could not be read; `retry` refetches them. */
  hasError: boolean;
  retry: () => void;
};

/** How members upvote signals in this space, read from its on-chain voting method. */
export function useSignalVotingMode(
  web3SpaceId?: number | null,
): SignalVotingModeState {
  const { spaceDetails, isLoading, error, refresh } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId ?? null,
  });
  const votingMode = signalVotingModeForSource(spaceDetails?.votingPowerSource);
  const retry = React.useCallback(() => {
    void refresh();
  }, [refresh]);
  return {
    votingMode,
    isLoading: votingMode == null && (isLoading || web3SpaceId == null),
    hasError: votingMode == null && error != null,
    retry,
  };
}
