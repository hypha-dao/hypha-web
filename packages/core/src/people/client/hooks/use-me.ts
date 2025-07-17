'use client';

import React from 'react';
import useSWR from 'swr';
import { Person, useJwt } from '@hypha-platform/core/client';

export const useMe = (): {
  person: Person | undefined;
  isLoading: boolean;
  revalidate: () => Promise<void>;
  isMe: (personSlug: string) => boolean;
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

  const isMe = React.useCallback(
    (personSlug: string) => {
      return (
        !isLoadingJwt &&
        !isLoadingPerson &&
        person?.slug &&
        personSlug &&
        person.slug === personSlug
      );
    },
    [person, isLoadingJwt, isLoadingPerson],
  );

  return {
    person,
    isLoading: isLoadingJwt || isLoadingPerson,
    revalidate: mutate,
    isMe,
  };
};
