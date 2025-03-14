import React from 'react';

import { z } from 'zod';
import {
  createSpaceClientService,
  CreateSpaceServiceState,
  schemaCreateSpace,
} from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { useAuthHeader } from './use-auth-header';
import invariant from 'tiny-invariant';

export const useSpaceCreate = () => {
  // Track the slug from the created web2 space
  const { headers, isLoading } = useAuthHeader();
  const [spaceSlug, setSpaceSlug] = React.useState<string>();
  const [state, setState] = React.useState<CreateSpaceServiceState>();

  const web3Config = useConfig();
  const createSpaceService = React.useMemo(
    () =>
      headers
        ? createSpaceClientService({
            web2: {
              endpoint: '/api/v1/spaces/create',
              headers,
            },
            web3: web3Config,
          })
        : undefined,
    [headers],
  );

  React.useEffect(() => {
    const unsubsribe = createSpaceService?.subscribe(setState);
    return () => unsubsribe && unsubsribe();
  }, [createSpaceService]);

  const createSpace = React.useCallback(
    async (data: z.infer<typeof schemaCreateSpace>) => {
      invariant(
        createSpaceService,
        'createSpaceService called before initialisation',
      );
      const space = await createSpaceService.createSpace(data);
      setSpaceSlug(space.slug);
    },
    [createSpaceService],
  );

  return {
    createSpace,
    progress: state?.progress,
    isLoading,
    isPending: Boolean(
      state?.progress && state.progress >= 0 && state.progress <= 100,
    ),
    spaceSlug,
  };
};
