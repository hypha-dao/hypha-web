'use client';

import useSWRMutation from 'swr/mutation';

import { CreateAgreementInput, UpdateAgreementBySlugInput } from '../../types';
import {
  createAgreementAction,
  updateAgreementBySlugAction,
  deleteAgreementBySlugAction,
} from '@hypha-platform/core/governance/server/actions';

export const useAgreementMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: createAgreementMutation,
    reset: resetCreateAgreementMutation,
    isMutating: isCreatingAgreement,
    error: errorCreateAgreementMutation,
    data: createdAgreement,
  } = useSWRMutation(
    authToken ? [authToken, 'createAgreement'] : null,
    async ([authToken], { arg }: { arg: CreateAgreementInput }) =>
      createAgreementAction(arg, { authToken }),
  );

  const {
    trigger: updateAgreementBySlugMutation,
    reset: resetUpdateAgreementBySlugMutation,
    isMutating: isUpdatingAgreement,
    error: errorUpdateAgreementBySlugMutation,
    data: updatedAgreement,
  } = useSWRMutation(
    authToken ? [authToken, 'updateAgreement'] : null,
    async ([authToken], { arg }: { arg: UpdateAgreementBySlugInput }) =>
      updateAgreementBySlugAction(arg, { authToken }),
  );

  const {
    trigger: deleteAgreementBySlugMutation,
    reset: resetDeleteAgreementBySlugMutation,
    isMutating: isDeletingAgreement,
    error: errorDeleteAgreementBySlugMutation,
    data: deletedAgreement,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteAgreement'] : null,
    async ([authToken], { arg }: { arg: { slug: string } }) =>
      deleteAgreementBySlugAction(arg, { authToken }),
  );

  return {
    createAgreement: createAgreementMutation,
    resetCreateAgreementMutation,
    isCreatingAgreement,
    errorCreateAgreementMutation,
    createdAgreement,

    updateAgreementBySlug: updateAgreementBySlugMutation,
    resetUpdateAgreementBySlugMutation,
    isUpdatingAgreement,
    errorUpdateAgreementBySlugMutation,
    updatedAgreement,

    deleteAgreementBySlug: deleteAgreementBySlugMutation,
    resetDeleteAgreementBySlugMutation,
    isDeletingAgreement,
    errorDeleteAgreementBySlugMutation,
    deletedAgreement,
  };
};
