'use client';

import { getPersonBySub } from '../../server/actions';
import { useJwt } from './useJwt';
import useSWR from 'swr';

export const usePersonBySub = ({ sub }: { sub?: string }) => {
  const { jwt } = useJwt();

  const { data: person, isLoading } = useSWR(
    sub && jwt ? [sub, jwt] : null,
    async ([sub]) => getPersonBySub({ sub }, { authToken: jwt ?? undefined }),
  );

  return { person, isLoading };
};
