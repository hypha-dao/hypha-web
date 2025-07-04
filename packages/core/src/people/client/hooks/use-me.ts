'use client';

import React from 'react';
import useSWR from 'swr';
import { Person, useJwt } from '@hypha-platform/core/client';

export const useMe = (): {
  person: Person | undefined;
  isLoading: boolean;
  revalidate: () => Promise<void>;
} => {
  const { jwt, isLoadingJwt } = useJwt();

  const endpoint = React.useMemo(() => '/api/v1/people/me', []);

  const {
    data: person,
    isLoading: isLoadingPerson,
    mutate,
  } = useSWR(jwt ? [endpoint, jwt] : null, ([endpoint, jwt]) =>
    fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json()),
  );

  const revalidate = React.useCallback(async () => {
    if (jwt) {
      await mutate([endpoint, jwt]);
    }
  }, [endpoint, jwt]);

  return {
    person,
    isLoading: isLoadingJwt || isLoadingPerson,
    revalidate,
  };
};
