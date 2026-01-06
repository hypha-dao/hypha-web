'use client';

import useSWRMutation from 'swr/mutation';
import {
  createCoherenceAction,
  deleteCoherenceBySlugAction,
  updateCoherenceBySlugAction,
} from '../../server/actions';
import { CreateCoherenceInput, UpdateCoherenceBySlugInput } from '../../types';

export const useCoherenceMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: createCoherenceMutation,
    reset: resetCreateCoherenceMutation,
    isMutating: isCreatingCoherence,
    error: errorCreateCoherenceMutation,
    data: createdCoherence,
  } = useSWRMutation(
    authToken ? [authToken, 'createCoherence'] : null,
    async ([authToken], { arg }: { arg: CreateCoherenceInput }) =>
      createCoherenceAction(arg, { authToken }),
  );

  const {
    trigger: updateCoherenceBySlugMutation,
    reset: resetUpdateCoherenceBySlugMutation,
    isMutating: isUpdatingCoherence,
    error: errorUpdateCoherenceBySlugMutation,
    data: updatedCoherence,
  } = useSWRMutation(
    authToken ? [authToken, 'updateCoherence'] : null,
    async ([authToken], { arg }: { arg: UpdateCoherenceBySlugInput }) =>
      updateCoherenceBySlugAction(arg, { authToken }),
  );

  const {
    trigger: deleteCoherenceBySlugMutation,
    reset: resetDeleteCoherenceBySlugMutation,
    isMutating: isDeletingCoherence,
    error: errorDeleteCoherenceBySlugMutation,
    data: deletedCoherence,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteCoherence'] : null,
    async ([authToken], { arg }: { arg: { slug: string } }) =>
      deleteCoherenceBySlugAction(arg, { authToken }),
  );

  return {
    createCoherence: createCoherenceMutation,
    resetCreateCoherenceMutation,
    isCreatingCoherence,
    errorCreateCoherenceMutation,
    createdCoherence,

    updateCoherenceBySlug: updateCoherenceBySlugMutation,
    resetUpdateCoherenceBySlugMutation,
    isUpdatingCoherence,
    errorUpdateCoherenceBySlugMutation,
    updatedCoherence,

    deleteCoherenceBySlug: deleteCoherenceBySlugMutation,
    resetDeleteCoherenceBySlugMutation,
    isDeletingCoherence,
    errorDeleteCoherenceBySlugMutation,
    deletedCoherence,
  };
};
