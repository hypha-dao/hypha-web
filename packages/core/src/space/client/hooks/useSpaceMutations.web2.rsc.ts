import useSWRMutation from 'swr/mutation';

import {
  CreateSpaceInput,
  DeleteSpaceBySlugInput,
  UpdateSpaceBySlugInput,
} from '../../types';
import {
  createSpaceAction,
  deleteSpaceBySlugAction,
  updateSpaceBySlugAction,
} from '@core/space/server/actions';

export const useSpaceMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: createSpaceMutation,
    reset: resetCreateSpaceMutation,
    isMutating: isCreatingSpace,
    error: errorCreateSpaceMutation,
    data: createdSpace,
  } = useSWRMutation(
    authToken ? [authToken, 'createSpace'] : null,
    async ([authToken], { arg }: { arg: CreateSpaceInput }) =>
      createSpaceAction(arg, { authToken }),
  );

  const {
    trigger: updateBySlugMutation,
    reset: resetUpdateSpaceBySlugMutation,
    isMutating: isUpdatingSpace,
    error: errorUpdateSpaceBySlugMutation,
    data: updatedSpace,
  } = useSWRMutation(
    authToken ? [authToken, 'updateSpace'] : null,
    async ([authToken], { arg }: { arg: UpdateSpaceBySlugInput }) =>
      updateSpaceBySlugAction(arg, { authToken }),
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
      deleteSpaceBySlugAction(arg, { authToken }),
  );

  return {
    createSpace: createSpaceMutation,
    resetCreateSpaceMutation,
    isCreatingSpace,
    errorCreateSpaceMutation,
    createdSpace,

    updateSpaceBySlug: updateBySlugMutation,
    resetUpdateSpaceBySlugMutation,
    isUpdatingSpace,
    errorUpdateSpaceBySlugMutation,
    updatedSpace,

    deleteSpaceBySlug: deleteSpaceBySlugMutation,
    resetDeleteSpaceBySlugMutation,
    isDeletingSpace,
    isSpaceDeleted,
    errorDeleteSpaceBySlugMutation,
  };
};
