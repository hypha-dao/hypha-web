'use client';

import { useEffect, useRef } from 'react';
import { getPeopleBySubs } from '../../server/actions';
import { useJwt } from './useJwt';
import useSWR from 'swr';

const PEOPLE_BY_SUBS_KEY = 'people-by-subs';
/** Matches `findPeopleBySubs` (`PEOPLE_BY_SUBS_LIMIT`). Server still caps each call. */
const PEOPLE_BY_SUBS_BATCH = 40;
/** After tab wake, a hung fetch used to leave DM titles on skeletons forever. */
const PEOPLE_BY_SUBS_TIMEOUT_MS = 15_000;

type PersonBySubRecord = Awaited<ReturnType<typeof getPeopleBySubs>>[number];

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    async () => {
      const batches: string[][] = [];
      for (let i = 0; i < unique.length; i += PEOPLE_BY_SUBS_BATCH) {
        batches.push(unique.slice(i, i + PEOPLE_BY_SUBS_BATCH));
      }
      const pages = await withTimeout(
        Promise.all(
          batches.map((chunk) =>
            getPeopleBySubs({ subs: chunk }, { authToken: jwt ?? undefined }),
          ),
        ),
        PEOPLE_BY_SUBS_TIMEOUT_MS,
        'people-by-subs',
      );
      return pages.flat();
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      errorRetryCount: 2,
    },
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (!key) return;
      void mutate();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [key, mutate]);

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
