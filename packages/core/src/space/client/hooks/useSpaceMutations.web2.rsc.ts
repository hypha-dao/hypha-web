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
  updateSpaceBySlugAction,
} from '@hypha-platform/core/space/server/actions';

function readApiError(
  payload: {
    error?:
      | string
      | {
          formErrors?: string[];
          fieldErrors?: Record<string, string[] | undefined>;
        };
  } | null,
): string | undefined {
  if (!payload?.error) return undefined;
  if (typeof payload.error === 'string') return payload.error;
  const fieldMessage = Object.values(payload.error.fieldErrors ?? {})
    .flatMap((messages) => messages ?? [])
    .find(Boolean);
  return fieldMessage ?? payload.error.formErrors?.[0];
}

async function patchSpaceViaApi(
  authToken: string,
  path: 'configuration' | 'record',
  arg: UpdateSpaceByIdInput,
) {
  const response = await fetch(`/api/v1/spaces/${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(arg),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?:
        | string
        | {
            formErrors?: string[];
            fieldErrors?: Record<string, string[] | undefined>;
          };
    } | null;
    throw new Error(
      readApiError(payload) ?? `Failed to update space (${response.status})`,
    );
  }
  return response.json();
}

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
      patchSpaceViaApi(authToken, 'record', arg),
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
      patchSpaceViaApi(authToken, 'configuration', arg),
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
