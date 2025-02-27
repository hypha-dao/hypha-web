'use client';

import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';

export const useCreateProfile = () => {
  const { getAccessToken, user } = useAuthentication();
  const endpoint = React.useMemo(() => '/api/v1/people/create-profile', []);

  const { data: jwt } = useSWR(user ? [user.id] : null, () => getAccessToken());

  const createProfile = React.useCallback(
    async (data: {
      name: string;
      surname: string;
      email: string;
      avatarUrl: string;
      description: string;
      location: string;
      nickname: string;
      sub: string;
    }) => {
      if (!jwt) {
        throw new Error('No JWT token available');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create profile');
      }

      const createdProfile = await response.json();
      return createdProfile;
    },
    [endpoint, jwt],
  );

  return { createProfile };
};
