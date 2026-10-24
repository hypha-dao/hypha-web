'use client';

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

  const { data, isLoading } = useSWR(key, async () => {
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
  });

  const peopleBySub = new Map<string, PersonBySubRecord>();
  for (const person of data ?? []) {
    peopleBySub.set(person.sub, person);
  }

  return {
    peopleBySub,
    isLoading: Boolean(key) && isLoading,
  };
};
