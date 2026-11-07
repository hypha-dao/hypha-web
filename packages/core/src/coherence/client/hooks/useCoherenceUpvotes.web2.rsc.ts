'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import {
  getMySignalVotingPowerAction,
  removeCoherenceUpvoteAction,
  upvoteCoherenceAction,
} from '../../server/actions';

/**
 * Upvote mutations for signals. Voting power is resolved server-side from the
 * space's on-chain voting power source; `votingPowerPercent` (default 100)
 * scales the caller's max power.
 */
export const useCoherenceUpvoteMutations = (authToken?: string | null) => {
  const {
    trigger: upvote,
    isMutating: isUpvoting,
    error: upvoteError,
  } = useSWRMutation(
    authToken ? [authToken, 'upvoteCoherence'] : null,
    async (
      [authToken],
      { arg }: { arg: { slug: string; votingPowerPercent?: number } },
    ) => upvoteCoherenceAction(arg, { authToken }),
  );

  const {
    trigger: removeUpvote,
    isMutating: isRemovingUpvote,
    error: removeUpvoteError,
  } = useSWRMutation(
    authToken ? [authToken, 'removeCoherenceUpvote'] : null,
    async ([authToken], { arg }: { arg: { slug: string } }) =>
      removeCoherenceUpvoteAction(arg, { authToken }),
  );

  return {
    upvote,
    isUpvoting,
    upvoteError,
    removeUpvote,
    isRemovingUpvote,
    removeUpvoteError,
  };
};

/** The signed-in member's current voting power in a space (raw units). */
export const useMySignalVotingPower = ({
  spaceSlug,
  authToken,
}: {
  spaceSlug?: string | null;
  authToken?: string | null;
}) => {
  const slug = spaceSlug?.trim() || null;
  const { data, isLoading, error } = useSWR(
    slug && authToken ? [authToken, slug, 'mySignalVotingPower'] : null,
    ([token, resolvedSlug]) =>
      getMySignalVotingPowerAction(
        { spaceSlug: resolvedSlug },
        { authToken: token },
      ),
    { revalidateOnFocus: false },
  );
  return { votingPower: data ?? null, isLoading, error };
};
