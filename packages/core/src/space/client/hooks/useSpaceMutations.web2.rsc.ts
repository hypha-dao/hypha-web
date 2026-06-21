'use client';

import useSWRMutation from 'swr/mutation';

import {
  CreateSpaceInput,
  DeleteSpaceBySlugInput,
  UpdateSpaceByIdInput,
  UpdateSpaceBySlugInput,
} from '../../types';
import {
  createSpaceAction,
  deleteSpaceBySlugAction,
  updateSpaceByIdAction,
  updateSpaceBySlugAction,
  updateSpaceConfigurationByIdAction,
} from '@hypha-platform/core/space/server/actions';

export const useSpaceMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: createSpaceMutation,
    reset: resetCreateSpaceMutation,
    isMutating: isCreatingSpace,
    error: errorCreateSpaceMutation,
    data: createdSpace,
  } = useSWRMutation(
    authToken ? [authToken, 'createSpace'] : null,
    async ([authToken], { arg }: { arg: CreateSpaceInput }) => {
      try {
        return await createSpaceAction(arg, { authToken });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('Server Action') &&
          message.includes('was not found')
        ) {
          const response = await fetch('/api/v1/spaces/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(arg),
          });
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              body?.error ?? `Failed to create space (${response.status})`,
            );
          }
          return response.json();
        }
        throw error;
      }
    },
  );

  const {
    trigger: updateBySlugMutation,
    reset: resetUpdateSpaceBySlugMutation,
    isMutating: isUpdatingSpaceBySlug,
    error: errorUpdateSpaceBySlugMutation,
    data: updatedSpaceBySlug,
  } = useSWRMutation(
    authToken ? [authToken, 'updateSpaceBySlug'] : null,
    async ([authToken], { arg }: { arg: UpdateSpaceBySlugInput }) =>
      await updateSpaceBySlugAction(arg, { authToken }),
  );

  const {
    trigger: updateByIdMutation,
    reset: resetUpdateSpaceByIdMutation,
    isMutating: isUpdatingSpaceById,
    error: errorUpdateSpaceByIdMutation,
    data: updatedSpaceById,
  } = useSWRMutation(
    authToken ? [authToken, 'updateSpaceById'] : null,
    async ([authToken], { arg }: { arg: UpdateSpaceByIdInput }) =>
      await updateSpaceByIdAction(arg, { authToken }),
  );

  const {
    trigger: updateConfigurationByIdMutation,
    reset: resetUpdateSpaceConfigurationByIdMutation,
    isMutating: isUpdatingSpaceConfigurationById,
    error: errorUpdateSpaceConfigurationByIdMutation,
    data: updatedSpaceConfigurationById,
  } = useSWRMutation(
    authToken ? [authToken, 'updateSpaceConfigurationById'] : null,
    async ([authToken], { arg }: { arg: UpdateSpaceByIdInput }) =>
      await updateSpaceConfigurationByIdAction(arg, { authToken }),
  );

  const {
    trigger: deleteSpaceBySlugMutation,
    reset: resetDeleteSpaceBySlugMutation,
    isMutating: isDeletingSpace,
    error: errorDeleteSpaceBySlugMutation,
    data: isSpaceDeleted,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteSpace'] : null,
    async ([authToken], { arg }: { arg: DeleteSpaceBySlugInput }) =>
      await deleteSpaceBySlugAction(arg, { authToken }),
  );

  return {
    createSpace: createSpaceMutation,
    resetCreateSpaceMutation,
    isCreatingSpace,
    errorCreateSpaceMutation,
    createdSpace,

    updateSpaceBySlug: updateBySlugMutation,
    resetUpdateSpaceBySlugMutation,
    isUpdatingSpaceBySlug,
    errorUpdateSpaceBySlugMutation,
    updatedSpaceBySlug,

    updateSpaceById: updateByIdMutation,
    resetUpdateSpaceByIdMutation,
    isUpdatingSpaceById,
    errorUpdateSpaceByIdMutation,
    updatedSpaceById,

    updateSpaceConfigurationById: updateConfigurationByIdMutation,
    resetUpdateSpaceConfigurationByIdMutation,
    isUpdatingSpaceConfigurationById,
    errorUpdateSpaceConfigurationByIdMutation,
    updatedSpaceConfigurationById,

    deleteSpaceBySlug: deleteSpaceBySlugMutation,
    resetDeleteSpaceBySlugMutation,
    isDeletingSpace,
    isSpaceDeleted,
    errorDeleteSpaceBySlugMutation,
  };
};
