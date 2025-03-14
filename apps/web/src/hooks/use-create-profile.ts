'use client';

import React from 'react';
import { useAuthHeader } from './use-auth-header';
import { z } from 'zod';

export const useCreateProfile = (
  endpoint: string = '/api/v1/people/create-profile',
) => {
  const { headers } = useAuthHeader();

  const createProfile = React.useCallback(
    async (data: {
      name: string;
      surname: string;
      email: string;
      avatarUrl: string;
      description: string;
      location: string;
      nickname: string;
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
      }

      const createdProfile = await response.json();
      return createdProfile;
    },
    [endpoint, headers],
  );

  return { createProfile };
};
