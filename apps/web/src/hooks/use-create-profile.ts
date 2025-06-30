'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { schemaSignupPerson, PersonFiles, useJwt } from '@core/people';
import { usePeopleFileUploads } from './use-people-file-uploads';
import { useAuthHeader } from './use-auth-header';

export const useCreateProfile = (
  endpoint = '/api/v1/people/create-profile',
) => {
  const { jwt } = useJwt();
  const { headers } = useAuthHeader();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { upload, isUploading } = usePeopleFileUploads({ authToken: jwt });

  const createProfile = useCallback(
    async (data: z.infer<typeof schemaSignupPerson>) => {
      if (!headers) {
        throw new Error('No auth headers available');
      }

      setIsCreating(true);
      setError(null);

      try {
        let uploadedFiles: Partial<PersonFiles> = {
          avatarUrl: undefined,
          leadImageUrl: undefined,
        };

        const filesToUpload: Partial<PersonFiles> = {
          avatarUrl: data.avatarUrl,
          leadImageUrl: data.leadImageUrl,
        };

        if (filesToUpload.avatarUrl || filesToUpload.leadImageUrl) {
          uploadedFiles = await upload(filesToUpload);
        }

        const payload = {
          ...data,
          avatarUrl: uploadedFiles.avatarUrl || data.avatarUrl || '',
          leadImageUrl: uploadedFiles.leadImageUrl || data.leadImageUrl || '',
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create profile');
        }

        const createdProfile = await response.json();
        router.push('/my-spaces');
        return createdProfile;
      } catch (err) {
        console.error('Profile creation error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [endpoint, headers, router, upload],
  );

  return {
    createProfile,
    isCreating: isCreating || isUploading,
    error,
  };
};
