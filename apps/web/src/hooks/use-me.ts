'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { Person } from '@hypha-platform/storage-postgres';
import { useRouter } from 'next/navigation';

interface UseMeHookProps {
  newUserRedirectPath: string;
}

export const useMe = ({
  newUserRedirectPath,
}: UseMeHookProps): { person: Person | undefined; isLoading: boolean } => {
  const { getAccessToken, user } = useAuthentication();
  const endpoint = React.useMemo(() => `/api/v1/people/me/`, []);
  const { data: jwt } = useSWR(user ? [user.id] : null, () => getAccessToken());
  const router = useRouter();

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

  React.useEffect(() => {
    if (!isLoading && !person) {
      router.push(newUserRedirectPath);
    }
  }, [isLoading, person, router, newUserRedirectPath]);

  return { person, isLoading };
};
