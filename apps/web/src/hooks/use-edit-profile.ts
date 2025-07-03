'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { schemaEditPerson, PersonFiles, useJwt } from '@core/people';
import { usePeopleFileUploads } from './use-people-file-uploads';
import { useAuthHeader } from './use-auth-header';

export const useEditProfile = (endpoint = '/api/v1/people/edit-profile') => {
  const { jwt } = useJwt();
  const { headers } = useAuthHeader();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { upload, isUploading } = usePeopleFileUploads({ authToken: jwt });

  const editProfile = useCallback(
    async (data: z.infer<typeof schemaEditPerson>) => {
      if (!headers) {
        throw new Error('No auth headers available');
      }

      setIsEditing(true);
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
          avatarUrl: uploadedFiles.avatarUrl,
          leadImageUrl: uploadedFiles.leadImageUrl,
        };
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update profile');
        }

        const updatedProfile = await response.json();
        router.refresh();
        return updatedProfile;
      } catch (err) {
        console.error('Profile update error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsEditing(false);
      }
    },
    [endpoint, headers, router, upload],
  );

  return {
    editProfile,
    isEditing: isEditing || isUploading,
    error,
  };
};
