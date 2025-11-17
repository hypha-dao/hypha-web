'use client';

import useSWRMutation from 'swr/mutation';

import { CreateTransferInput } from '../types';
import { createTransferAction } from '../server/actions';

export const useTransferMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: createTransferMutation,
    reset: resetCreateTransferMutation,
    isMutating: isCreatingTransfer,
    error: errorCreateTransferMutation,
    data: createdTransfer,
  } = useSWRMutation(
    authToken ? [authToken, 'createTransfer'] : null,
    async ([authToken], { arg }: { arg: CreateTransferInput }) =>
      createTransferAction(arg, { authToken }),
  );

  return {
    createTransfer: createTransferMutation,
    resetCreateTransferMutation,
    isCreatingTransfer,
    errorCreateTransferMutation,
    createdTransfer,
  };
};
