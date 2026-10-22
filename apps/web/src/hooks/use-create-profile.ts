'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Person, PersonFiles, useJwt } from '@hypha-platform/core/client';
import { writeHomeView } from '@hypha-platform/epics';
import { usePeopleFileUploads } from './use-people-file-uploads';
import type { ProfileFormData } from './profile-form-data';
import { useSWRConfig } from 'swr';
import {
  resolvePostAuthRedirectPath,
  useAuthentication,
} from '@hypha-platform/authentication';

/**
 * The signup form can sit open longer than the cached Bearer token. Privy
 * still has the session; the SWR copy may be empty because an early
 * "token not ready" fetch gave up. Ask Privy again at submit, and keep the
 * cached token when Privy is briefly empty.
 */
async function resolveAccessToken(
  cached: string | undefined,
  getAccessToken: () => Promise<string | null>,
): Promise<string | null> {
  const readFresh = async () => {
    try {
      const fresh = await getAccessToken();
      return fresh?.trim() || null;
    } catch {
      return null;
    }
  };

  const fresh = await readFresh();
  if (fresh) return fresh;
  const cachedToken = cached?.trim();
  if (cachedToken) return cachedToken;

  for (let attempt = 0; attempt < 7; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    const retry = await readFresh();
    if (retry) return retry;
  }

  return null;
}

export const useCreateProfile = (
  endpoint = '/api/v1/people/create-profile',
) => {
  const { jwt } = useJwt();
  const { getAccessToken, user } = useAuthentication();
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { upload, isUploading } = usePeopleFileUploads({ authToken: jwt });

  const createProfile = useCallback(
    async (data: ProfileFormData) => {
      setIsCreating(true);
      setError(null);

      try {
        const token = await resolveAccessToken(jwt, getAccessToken);
        if (!token) {
          throw new Error('No auth headers available');
        }
        if (user?.id && token !== jwt) {
          await mutate([user.id, 'jwt'], token, { revalidate: false });
        }
        let uploadedFiles: Partial<PersonFiles> = {
          avatarUrl: undefined,
          leadImageUrl: undefined,
        };

        const filesToUpload: Partial<PersonFiles> = {
          avatarUrl: data.avatarUrl,
          leadImageUrl: data.leadImageUrl,
        };

        if (filesToUpload.avatarUrl || filesToUpload.leadImageUrl) {
          uploadedFiles = await upload(filesToUpload, token);
        }

        const httpUrl = (value: unknown) =>
          typeof value === 'string' && /^https?:\/\//.test(value) ? value : '';
        const payload = {
          ...data,
          // A File becomes `{}` in JSON and the whole profile is rejected.
          avatarUrl:
            httpUrl(uploadedFiles.avatarUrl) || httpUrl(data.avatarUrl),
          leadImageUrl:
            httpUrl(uploadedFiles.leadImageUrl) || httpUrl(data.leadImageUrl),
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'profile_create_failed');
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

        const lang = params?.lang;
        const homePath = lang ? `/${lang}/home` : '/en/home';
        // Consume a stored space return so it does not pull a new member
        // onto a space dashboard. Orientation opens the AI home.
        resolvePostAuthRedirectPath({
          pathname:
            typeof window !== 'undefined' ? window.location.pathname : '',
          lang: typeof lang === 'string' ? lang : undefined,
          baseRedirectPath: homePath,
        });

        // Prevent post-signup redirect guards from briefly treating the user
        // as profile-less on the next route transition.
        await mutate(['/api/v1/people/me', token], createdProfile, {
          revalidate: false,
        });
        writeHomeView('ai');
        router.replace(homePath);
        return createdProfile;
      } catch (err) {
        console.error('Profile creation error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [
      endpoint,
      getAccessToken,
      jwt,
      mutate,
      params?.lang,
      router,
      upload,
      user?.id,
    ],
  );

  return {
    createProfile,
    isCreating: isCreating || isUploading,
    error,
  };
};
