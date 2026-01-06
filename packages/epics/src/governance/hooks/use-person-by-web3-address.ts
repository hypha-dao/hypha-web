'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt, Person } from '@hypha-platform/core/client';
import { isAddress } from 'ethers';

type UsePersonByWeb3AddressReturn = {
  person?: Person | null;
  isLoading: boolean;
};

export const usePersonByWeb3Address = (
  address: `0x${string}`,
): UsePersonByWeb3AddressReturn => {
  const { jwt } = useJwt();

  const endpoint = React.useMemo(
    () => `/api/v1/people/by-web3-address/${address}`,
    [address],
  );

  const { data: person, isLoading } = useSWR(
    isAddress(address) && address !== '0x0' && jwt ? [endpoint, jwt] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );

  return { person, isLoading };
};
