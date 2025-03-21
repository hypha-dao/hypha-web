import React from 'react';
import { useAuthHeader } from '../use-auth-header';
import invariant from 'tiny-invariant';
import * as spaceClient from '@hypha-platform/core/client';
import { type UpdateSpaceInput } from '@hypha-platform/core/client';

export const useSpaceUpdateWeb2 = (endpoint?: string) => {
  const { headers } = useAuthHeader();

  const updateSpace = React.useCallback(
    async (data: UpdateSpaceInput) => {
      invariant(endpoint, 'endpoint is required');
      invariant(headers, 'no auth header present');

      return spaceClient.updateSpaceWeb2(data, { endpoint, headers });
    },
    [endpoint],
  );

  return { updateSpace };
};
