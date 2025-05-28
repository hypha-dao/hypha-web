'use client';

import useSWRMutation from 'swr/mutation';

import {
  CreateChangeEntryMethodInput,
  UpdateChangeEntryMethodBySlugInput,
} from '../../types';
import {
  createChangeEntryMethodAction,
  updateChangeEntryMethodBySlugAction,
  deleteChangeEntryMethodBySlugAction,
} from '@core/governance/server/actions';

export const useChangeEntryMethodMutationsWeb2Rpc = (authToken?: string | null) => {
  const {
    trigger: createChangeEntryMethodMutation,
    reset: resetCreateChangeEntryMethodMutation,
    isMutating: isCreatingChangeEntryMethod,
    error: errorCreateChangeEntryMethodMutation,
    data: createdChangeEntryMethod,
  } = useSWRMutation(
    authToken ? [authToken, 'createChangeEntryMethod'] : null,
    async ([authToken], { arg }: { arg: CreateChangeEntryMethodInput }) =>
      createChangeEntryMethodAction(arg, { authToken }),
  );

  const {
    trigger: updateChangeEntryMethodBySlugMutation,
    reset: resetUpdateChangeEntryMethodBySlugMutation,
    isMutating: isUpdatingChangeEntryMethod,
    error: errorUpdateChangeEntryMethodBySlugMutation,
    data: updatedChangeEntryMethod,
  } = useSWRMutation(
    authToken ? [authToken, 'updateChangeEntryMethod'] : null,
    async ([authToken], { arg }: { arg: UpdateChangeEntryMethodBySlugInput }) =>
      updateChangeEntryMethodBySlugAction(arg, { authToken }),
  );

  const {
    trigger: deleteChangeEntryMethodBySlugMutation,
    reset: resetDeleteChangeEntryMethodBySlugMutation,
    isMutating: isDeletingChangeEntryMethod,
    error: errorDeleteChangeEntryMethodBySlugMutation,
    data: deletedChangeEntryMethod,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteChangeEntryMethod'] : null,
    async ([authToken], { arg }: { arg: { slug: string } }) =>
      deleteChangeEntryMethodBySlugAction(arg, { authToken }),
  );

  return {
    createChangeEntryMethod: createChangeEntryMethodMutation,
    resetCreateChangeEntryMethodMutation,
    isCreatingChangeEntryMethod,
    errorCreateChangeEntryMethodMutation,
    createdChangeEntryMethod,

    updateChangeEntryMethodBySlug: updateChangeEntryMethodBySlugMutation,
    resetUpdateChangeEntryMethodBySlugMutation,
    isUpdatingChangeEntryMethod,
    errorUpdateChangeEntryMethodBySlugMutation,
    updatedChangeEntryMethod,

    deleteChangeEntryMethodBySlug: deleteChangeEntryMethodBySlugMutation,
    resetDeleteChangeEntryMethodBySlugMutation,
    isDeletingChangeEntryMethod,
    errorDeleteChangeEntryMethodBySlugMutation,
    deletedChangeEntryMethod,
  };
};
