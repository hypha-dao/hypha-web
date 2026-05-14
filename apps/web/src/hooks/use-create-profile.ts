'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  Person,
  schemaSignupPerson,
  PersonFiles,
  useJwt,
} from '@hypha-platform/core/client';
import { usePeopleFileUploads } from './use-people-file-uploads';
import { useAuthHeader } from './use-auth-header';
import type { ProfileFormData } from './profile-form-data';
import { useSWRConfig } from 'swr';

export const useCreateProfile = (
  endpoint = '/api/v1/people/create-profile',
) => {
  const { jwt } = useJwt();
  const { headers } = useAuthHeader();
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { upload, isUploading } = usePeopleFileUploads({ authToken: jwt });

  const createProfile = useCallback(
    async (data: ProfileFormData) => {
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
          throw new Error(errorData.error || 'Failed to create profile');
        }

        const createdProfileResponse = (await response.json()) as
          | { profile?: Person }
          | Person;
        const createdProfile =
          'profile' in createdProfileResponse
            ? createdProfileResponse.profile
            : createdProfileResponse;
        if (!createdProfile) {
          throw new Error('Profile was created but missing from response');
        }

        // Prevent post-signup redirect guards from briefly treating the user
        // as profile-less on the next route transition.
        if (jwt) {
          await mutate(['/api/v1/people/me', jwt], createdProfile, {
            revalidate: false,
          });
        }

        const lang = params?.lang;
        const onboardingPath = lang ? `/${lang}/onboarding` : '/en/profile';
        router.replace(onboardingPath);
        return createdProfile;
      } catch (err) {
        console.error('Profile creation error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [endpoint, headers, jwt, mutate, params?.lang, router, upload],
  );

  return {
    createProfile,
    isCreating: isCreating || isUploading,
    error,
  };
};
