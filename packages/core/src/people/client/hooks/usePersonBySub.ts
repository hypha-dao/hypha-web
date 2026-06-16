'use client';

import { getPersonBySub } from '../../server/actions';
import { useJwt } from './useJwt';
import React from 'react';
import useSWR from 'swr';

type PersonBySubRecord = Awaited<ReturnType<typeof getPersonBySub>>;
const personBySubCache = new Map<string, NonNullable<PersonBySubRecord>>();

export const usePersonBySub = ({ sub }: { sub?: string }) => {
  const { jwt } = useJwt();
  const trimmedSub = sub?.trim();
  const [stablePerson, setStablePerson] = React.useState<
    NonNullable<PersonBySubRecord> | undefined
  >(() => {
    if (!trimmedSub) return undefined;
    return personBySubCache.get(trimmedSub);
  });

  React.useEffect(() => {
    if (!trimmedSub) {
      setStablePerson(undefined);
      return;
    }
    setStablePerson(personBySubCache.get(trimmedSub));
  }, [trimmedSub]);

  const { data: person, isLoading } = useSWR(
    trimmedSub && jwt ? [trimmedSub, jwt] : null,
    async ([sub]) => getPersonBySub({ sub }, { authToken: jwt ?? undefined }),
  );

  React.useEffect(() => {
    if (!trimmedSub || !person) return;
    personBySubCache.set(trimmedSub, person);
    setStablePerson(person);
  }, [trimmedSub, person]);

  const resolvedPerson = person ?? stablePerson;

  return {
    person: resolvedPerson,
    isLoading: Boolean(trimmedSub) && !resolvedPerson && isLoading,
  };
};
