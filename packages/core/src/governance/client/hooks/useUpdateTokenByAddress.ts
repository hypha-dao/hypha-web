'use client';

import useSWR from 'swr';
import { getTokenUpdateByAddressAction } from '../../server/actions';

export const useUpdateTokenByAddress = ({
  address,
  authToken,
}: {
  address?: string;
  authToken?: string;
}) => {
  const { data, isLoading, error, mutate } = useSWR(
    authToken && address ? [address, authToken, 'updateTokenByAddress'] : null,
    async ([address, authToken]) =>
      getTokenUpdateByAddressAction(address, { authToken }),
    {
      refreshInterval: 10000,
    },
  );

  return { tokenUpdate: data ?? undefined, isLoading, error, mutate };
};
