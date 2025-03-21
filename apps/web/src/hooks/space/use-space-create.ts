import React from 'react';
import { useSpaceCreateWeb2 } from './use-space-create.web2';
import { useSpaceUpdateWeb2 } from './use-space-update.web2';
import { useSpaceCreateWeb3 } from './use-space-create.web3';

import { z } from 'zod';
import {
  schemaCreateSpace,
  schemaCreateSpaceWeb2,
  schemaCreateSpaceWeb3,
} from '@hypha-platform/core/client';

export const useSpaceCreate = () => {
  // Track the slug from the created web2 space
  const [web2Slug, setWeb2Slug] = React.useState<string | null>(null);
  const [isLinked, toggleIsLinked] = React.useReducer((s) => !s, false);
  const [isLoading, toggleIsLoading] = React.useReducer((s) => !s, false);

  const { createSpace: createSpaceWeb3, spaceId } = useSpaceCreateWeb3();
  const { createSpace: createSpaceWeb2 } = useSpaceCreateWeb2();
  const { updateSpace } = useSpaceUpdateWeb2(
    `/api/v1/spaces/${web2Slug}/update`,
  );

  React.useEffect(() => {
    // when web3 space ID is available and web2 space has been created (we have the slug)
    // link them together by updating the web2 space with the web3 space ID
    if (spaceId && web2Slug) {
      updateSpace({
        web3SpaceId: spaceId,
      })
        .catch((error) => {
          console.error('Failed to link spaces:', error);
        })
        .finally(() => {
          toggleIsLinked();
          toggleIsLoading();
        });
    }
  }, [spaceId, web2Slug, updateSpace]);

  const progress = React.useMemo(() => {
    const isCreating = web2Slug !== null || spaceId !== null;

    // Initial state - not started
    if (!isCreating) return { percent: 0, status: 'idle' };

    // Both created and linked
    if (isLinked) return { percent: 100, status: 'complete' };

    // Both created but not linked yet
    if (web2Slug && spaceId) return { percent: 66, status: 'linking' };

    // Only web2 created
    if (web2Slug) return { percent: 33, status: 'creating_web3' };

    // Only web3 created
    if (spaceId) return { percent: 33, status: 'creating_web2' };

    // Default case (should not reach here)
    return { percent: 10, status: 'creating' };
  }, [spaceId, web2Slug, isLinked]);

  const createSpace = React.useCallback(
    async (data: z.infer<typeof schemaCreateSpace>) => {
      toggleIsLoading();
      try {
        // Parse inputs for both web2 and web3
        const inputCreateSpaceWeb2 = schemaCreateSpaceWeb2.parse(data);
        const inputCreateSpaceWeb3 = schemaCreateSpaceWeb3.parse(data);

        // Launch both creation processes in parallel
        const [web2Result] = await Promise.all([
          createSpaceWeb2(inputCreateSpaceWeb2),
          createSpaceWeb3(inputCreateSpaceWeb3),
        ]);

        // Store the web2 space slug for later linking
        if (web2Result?.slug) {
          setWeb2Slug(web2Result.slug);
        }
      } catch (error) {
        console.error('Error creating space:', error);
        throw error;
      }
    },
    [createSpaceWeb2, createSpaceWeb3],
  );

  return { createSpace, progress, isLoading, spaceSlug: web2Slug };
};
