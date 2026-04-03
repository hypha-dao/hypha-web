'use client';

import useSWR from 'swr';
import { getTokenUpdateForSpaceTokenAddressAction } from '../../server/actions';

export const useTokenUpdateForSpaceTokenAddress = ({
  spaceId,
  tokenAddress,
  authToken,
}: {
  spaceId?: number | null;
  tokenAddress?: string | null;
  authToken?: string;
}) => {
  const { data, isLoading, error, mutate } = useSWR(
    authToken &&
      spaceId != null &&
      spaceId > 0 &&
      tokenAddress &&
      tokenAddress.startsWith('0x')
      ? [spaceId, tokenAddress.toLowerCase(), authToken, 'tokenUpdateSpace']
      : null,
    async ([sid, addr, token]) =>
      getTokenUpdateForSpaceTokenAddressAction(sid as number, addr as string, {
        authToken: token as string,
      }),
    { refreshInterval: 10000 },
  );

  return { tokenUpdate: data ?? undefined, isLoading, error, mutate };
};
