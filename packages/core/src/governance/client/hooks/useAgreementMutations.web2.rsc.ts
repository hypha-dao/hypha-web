'use client';

import useSWRMutation from 'swr/mutation';
import { mutate as globalMutate } from 'swr';

import { CreateAgreementInput, UpdateAgreementBySlugInput } from '../../types';
import {
  createAgreementAction,
  updateAgreementBySlugAction,
  deleteAgreementBySlugAction,
} from '@hypha-platform/core/governance/server/actions';

/**
 * Revalidate every mounted space documents list (`/api/v1/spaces/.../documents/all`).
 * Called after a document is created/updated (e.g. once an orchestrator links the
 * new `web3ProposalId`) so the proposal card shows up in the agreements list as
 * soon as the create overlay closes instead of waiting for the next poll. Fired
 * twice (immediate + short delay) to absorb brief DB read propagation.
 */
const revalidateSpaceDocuments = () => {
  const matchDocumentsAllKey = (key: unknown) =>
    Array.isArray(key) &&
    typeof key[0] === 'string' &&
    key[0].includes('/documents/all');
  void globalMutate(matchDocumentsAllKey, undefined, { revalidate: true });
  setTimeout(() => {
    void globalMutate(matchDocumentsAllKey, undefined, { revalidate: true });
  }, 1500);
};

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
    async ([authToken], { arg }: { arg: UpdateAgreementBySlugInput }) => {
      const result = await updateAgreementBySlugAction(arg, { authToken });
      revalidateSpaceDocuments();
      return result;
    },
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
