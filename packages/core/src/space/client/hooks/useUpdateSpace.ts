'use client';

import useSWRMutation from 'swr/mutation';
import { useSpaceFileUploads } from './useSpaceFileUploads';
import { useSpaceMutationsWeb2Rsc } from './useSpaceMutations.web2.rsc';
import {
  schemaCreateSpace,
  schemaCreateSpaceFiles,
} from '@core/space/validation';
import { z } from 'zod';
import invariant from 'tiny-invariant';

type UseUpdateSpaceInput = {
  authToken?: string | null;
};

export const useUpdateSpace = ({ authToken }: UseUpdateSpaceInput) => {
  const web2 = useSpaceMutationsWeb2Rsc(authToken);
  const files = useSpaceFileUploads(authToken);

  const { trigger: updateSpace, isMutating } = useSWRMutation(
    'updateSpaceMutation',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateSpace> }) => {
      console.debug('updateSpaceMutation', { arg });
      const { slug } = arg;
      invariant(slug, 'slug is required');
      const inputCreateSpaceFiles = schemaCreateSpaceFiles.parse(arg);
      const urls = await files.upload(inputCreateSpaceFiles);
      web2.updateSpaceBySlug({ ...arg, ...urls, slug });
    },
  );

  return {
    isMutating,
    updateSpace,
  };
};
