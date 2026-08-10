'use client';

import React from 'react';
import useSWR from 'swr';
import { Person, useJwt } from '@hypha-platform/core/client';

export const useMe = (): {
  person: Person | undefined;
  isLoading: boolean;
  /**
   * Refetch `/me`, or set cache from a known-good `Person` (e.g. right after save)
   * without waiting for a network round-trip.
   */
  revalidate: (next?: Person) => Promise<Person | undefined>;
  isMe: (personSlug: string) => boolean;
} => {
  const { jwt, isLoadingJwt } = useJwt();

  const endpoint = React.useMemo(() => '/api/v1/people/me', []);

  const {
    data: person,
    isLoading: isLoadingPerson,
    mutate,
  } = useSWR<Person>(
    jwt ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });
      // A 500 body like `{ error: "..." }` must not be cached as a Person —
      // that clears `slug` and sends the wallet into a full-page loader.
      if (!res.ok) {
        throw new Error(`Failed to fetch profile: ${res.status}`);
      }
      return (await res.json()) as Person;
    },
    {
      // JWT refresh changes the SWR key; keep the last good profile so the
      // wallet does not unmount into "Loading..." every few minutes.
      keepPreviousData: true,
    },
  );

  const isMe = React.useCallback(
    (personSlug: string): boolean => {
      if (isLoadingJwt || isLoadingPerson) return false;
      if (!person?.slug || !personSlug) return false;
      return person.slug === personSlug;
    },
    [person, isLoadingJwt, isLoadingPerson],
  );

  const revalidate = React.useCallback(
    (next?: Person): Promise<Person | undefined> => {
      if (next) {
        return mutate(next, { revalidate: false });
      }
      return mutate();
    },
    [mutate],
  );

  return {
    person,
    isLoading: isLoadingJwt || isLoadingPerson,
    revalidate,
    isMe,
  };
};
