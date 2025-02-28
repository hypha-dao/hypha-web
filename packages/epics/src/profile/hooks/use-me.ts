'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

export const useMe = () => {
  const { getAccessToken, user } = useAuthentication();
  const endpoint = React.useMemo(() => `/api/v1/people/me/`, []);

  const { data: jwt } = useSWR(user ? [user.id] : null, () => getAccessToken());

  console.debug('useMe', { endpoint });
  const { data: person, isLoading } = useSWR(
    jwt ? [endpoint, jwt] : null,
    ([endpoint, jwt]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );
  return { person, isLoading };
};
