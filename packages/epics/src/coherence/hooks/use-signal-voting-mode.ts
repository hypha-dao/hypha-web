'use client';

import React from 'react';
import {
  signalVotingModeForSource,
  useSpaceDetailsWeb3Rpc,
  type SignalVotingMode,
} from '@hypha-platform/core/client';

/**
 * `unavailable`: the space has no on-chain id, so it has no voting method
 * and nothing will load.
 */
export type SignalVotingModeStatus =
  | 'loading'
  | 'ready'
  | 'error'
  | 'unavailable';

export type SignalVotingModeState = {
  /** `null` until the space details resolve, so callers never guess a mode. */
  votingMode: SignalVotingMode | null;
  status: SignalVotingModeStatus;
  /** Refetches the space details after an error. */
  retry: () => void;
};

/**
 * How members upvote signals in this space, read from its on-chain voting
 * method. Pass `undefined` while the space itself is loading and `null` when
 * the loaded space has no on-chain id.
 */
export function useSignalVotingMode(
  web3SpaceId: number | null | undefined,
): SignalVotingModeState {
  const { spaceDetails, error, refresh } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId ?? null,
  });
  const votingMode = signalVotingModeForSource(spaceDetails?.votingPowerSource);
  const retry = React.useCallback(() => {
    void refresh();
  }, [refresh]);
  const status: SignalVotingModeStatus =
    votingMode != null
      ? 'ready'
      : web3SpaceId === null
      ? 'unavailable'
      : error != null
      ? 'error'
      : 'loading';
  return { votingMode, status, retry };
}

/** `web3SpaceId` argument for a space that may still be loading. */
export function signalVotingSpaceId(
  space: { web3SpaceId?: number | null } | null | undefined,
): number | null | undefined {
  return space ? space.web3SpaceId ?? null : undefined;
}
