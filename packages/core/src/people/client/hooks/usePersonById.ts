'use client';

import useSWR from 'swr';
import { getPersonById } from '../../server/actions';
import { useJwt } from './useJwt';

export const usePersonById = ({ id }: { id?: number }) => {
  const { jwt } = useJwt();

  const { data: person, isLoading } = useSWR(
    id && jwt ? [id, jwt] : null,
    async ([id]) => getPersonById({ id }, { authToken: jwt ?? undefined }),
  );

  return { person, isLoading };
};
