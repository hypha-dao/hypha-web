import React from 'react';
import { useAuthHeader } from '../use-auth-header';
import invariant from 'tiny-invariant';
import * as spaceClient from '@hypha-platform/core/client';
import { CreateSpaceInput } from '@hypha-platform/core/server';

export const useSpaceCreateWeb2 = (
  endpoint: string = '/api/v1/spaces/create',
) => {
  const { headers, isLoading: isLoadingHeaders } = useAuthHeader();

  const createSpace = React.useCallback(
    async (data: CreateSpaceInput) => {
      invariant(headers, 'no auth header present');
      return spaceClient.createSpaceWeb2(data, { endpoint, headers });
    },
    [headers, endpoint],
  );

  return { createSpace };
};
