'use client';

import React from 'react';
import useSWR from 'swr';
import { Person, useJwt } from '@hypha-platform/core/client';

export const ME_USER_NOT_FOUND_ERROR = 'User not found';

export const useMe = (): {
  person: Person | undefined;
  isLoading: boolean;
  /** True when Privy auth succeeded but no Hypha profile row exists yet. */
  needsProfileSetup: boolean;
  /** Set when `/me` failed for reasons other than a missing profile. */
  profileError: string | undefined;
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
    error: swrError,
    isLoading: isLoadingPerson,
    mutate,
  } = useSWR<Person>(jwt ? [endpoint, jwt] : null, ([endpoint, jwt]) =>
    fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    }).then(async (res) => {
      const payload = (await res.json()) as Person | { error?: string };
      if (!res.ok || !('slug' in payload) || !payload.slug) {
        throw new Error(
          'error' in payload && payload.error
            ? payload.error
            : `Failed to load profile (${res.status})`,
        );
      }
      return payload;
    }),
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

  const profileError = swrError instanceof Error ? swrError.message : undefined;
  const needsProfileSetup = profileError === ME_USER_NOT_FOUND_ERROR;

  return {
    person,
    isLoading: isLoadingJwt || isLoadingPerson,
    needsProfileSetup,
    profileError,
    revalidate,
    isMe,
  };
};
