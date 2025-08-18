'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt, Person } from '@hypha-platform/core/client';

type UsePersonByWeb3AddressReturn = {
  person: Person;
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
    jwt ? [endpoint, jwt] : null,
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
