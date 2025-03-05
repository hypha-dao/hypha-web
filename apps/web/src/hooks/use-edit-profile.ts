'use client';

import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';

export const useEditProfile = () => {
  const { getAccessToken, user } = useAuthentication();
  const endpoint = React.useMemo(() => '/api/v1/people/edit-profile', []);

  const { data: jwt } = useSWR(user ? [user.id] : null, () => getAccessToken());

  const editProfile = React.useCallback(
    async (data: {
      description: string;
      leadImageUrl: string;
      id: number | null;
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
        throw new Error('Failed to edit profile');
      }

      const updatedProfile = await response.json();
      return updatedProfile;
    },
    [endpoint, jwt],
  );

  return { editProfile };
};
