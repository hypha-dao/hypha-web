'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthHeader } from './use-auth-header';

export const useCreateProfile = (
  endpoint = '/api/v1/people/create-profile',
) => {
  const { headers } = useAuthHeader();
  const router = useRouter();

  const createProfile = React.useCallback(
    async (data: {
      name: string;
      surname: string;
      email: string;
      avatarUrl: string;
      leadImageUrl: string;
      description: string;
      location: string;
      nickname: string;
      address: string;
    }) => {
      if (!headers) {
        throw new Error('No auth headers available');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create profile');
      } else {
        router.push('/my-spaces');
      }

      const createdProfile = await response.json();
      return createdProfile;
    },
    [endpoint, headers],
  );

  return { createProfile };
};
