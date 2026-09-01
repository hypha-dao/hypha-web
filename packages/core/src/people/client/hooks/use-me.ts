'use client';

import React from 'react';
import useSWR from 'swr';
import { Person, useJwt } from '@hypha-platform/core/client';
import { readPersonFromMeResponse } from './read-person-from-me-response';

export const useMe = (): {
  /** `undefined` while loading; `null` when authenticated but no profile row (GET /me 404). */
  person: Person | null | undefined;
  isLoading: boolean;
  meError: Error | undefined;
  /**
   * Refetch `/me`, or set cache from a known-good `Person` (e.g. right after save)
   * without waiting for a network round-trip.
   */
  revalidate: (next?: Person) => Promise<Person | null | undefined>;
  isMe: (personSlug: string) => boolean;
} => {
  const { jwt, isLoadingJwt } = useJwt();

  const endpoint = React.useMemo(() => '/api/v1/people/me', []);

  const {
    data: person,
    isLoading: isLoadingPerson,
    error: meError,
    mutate,
  } = useSWR<Person | null>(
    jwt ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });
      return readPersonFromMeResponse(res);
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
    (next?: Person): Promise<Person | null | undefined> => {
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
    meError: meError as Error | undefined,
    revalidate,
    isMe,
  };
};
