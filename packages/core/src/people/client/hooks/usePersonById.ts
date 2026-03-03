'use client';

import React from 'react';
import { getPersonById } from '../../server/actions';
import { useJwt } from './useJwt';
import useSWR from 'swr';

export const usePersonById = ({ id }: { id?: number }) => {
  const { jwt } = useJwt();

  const { data: person, isLoading } = useSWR(
    id && jwt ? [id, jwt] : null,
    async ([id]) => getPersonById({ id }, { authToken: jwt ?? undefined }),
  );

  return { person, isLoading };
};
