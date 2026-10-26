'use client';

import { useRef } from 'react';
import { getPeopleBySubs } from '../../server/actions';
import { useJwt } from './useJwt';
import useSWR from 'swr';

const PEOPLE_BY_SUBS_KEY = 'people-by-subs';
/** Matches `findPeopleBySubs` (`PEOPLE_BY_SUBS_LIMIT`). Server still caps each call. */
const PEOPLE_BY_SUBS_BATCH = 40;

type PersonBySubRecord = Awaited<ReturnType<typeof getPeopleBySubs>>[number];

export const usePeopleBySubs = ({
  subs,
}: {
  subs?: readonly string[] | null;
}) => {
  const { jwt } = useJwt();
  const unique = [
    ...new Set((subs ?? []).map((sub) => sub.trim()).filter(Boolean)),
  ].sort();
  const key =
    unique.length > 0 && jwt
      ? [PEOPLE_BY_SUBS_KEY, jwt, unique.join('\n')]
      : null;

  // Rooms stream in after reload; keep profiles already fetched so a new SWR
  // key does not blank every DM title back to a skeleton.
  const cacheRef = useRef(new Map<string, PersonBySubRecord>());
  const lookedUpRef = useRef(new Set<string>());

  const { data, error, isLoading, isValidating } = useSWR(
    key,
    async () => {
      const batches: string[][] = [];
      for (let i = 0; i < unique.length; i += PEOPLE_BY_SUBS_BATCH) {
        batches.push(unique.slice(i, i + PEOPLE_BY_SUBS_BATCH));
      }
      const pages = await Promise.all(
        batches.map((chunk) =>
          getPeopleBySubs({ subs: chunk }, { authToken: jwt ?? undefined }),
        ),
      );
      return pages.flat();
    },
    { keepPreviousData: true },
  );

  for (const person of data ?? []) {
    cacheRef.current.set(person.sub, person);
  }
  if (key && !isLoading && !isValidating && (data !== undefined || error)) {
    for (const sub of unique) lookedUpRef.current.add(sub);
  }

  const peopleBySub = new Map(cacheRef.current);
  const pendingSubs = new Set(
    unique.filter(
      (sub) => !peopleBySub.has(sub) && !lookedUpRef.current.has(sub),
    ),
  );

  return {
    peopleBySub,
    pendingSubs,
    isLoading: Boolean(key) && pendingSubs.size > 0,
  };
};
