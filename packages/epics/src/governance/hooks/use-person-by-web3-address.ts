'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt, Person } from '@hypha-platform/core/client';

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

  // The endpoint is public, so we fetch regardless of auth state. This ensures
  // person data (e.g. the delegated voting member) is shown even when the
  // viewer is logged out. The JWT is forwarded only when it is available.
  const { data: person, isLoading } = useSWR(
    address ? [endpoint, jwt] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );

  return { person, isLoading };
};
