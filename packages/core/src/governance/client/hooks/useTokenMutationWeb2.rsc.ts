'use client';

import useSWRMutation from 'swr/mutation';
import { CreateTokenInput, DeleteTokenInput } from '../../types';
import { createTokenAction, deleteTokenAction } from '../../server/actions';

export const useTokenMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: createTokenMutation,
    reset: resetCreateTokenMutation,
    isMutating: isCreatingToken,
    error: errorCreateTokenMutation,
    data: createdToken,
  } = useSWRMutation(
    authToken ? [authToken, 'createToken'] : null,
    async ([authToken], { arg }: { arg: CreateTokenInput }) =>
      createTokenAction(arg, { authToken }),
  );

  const {
    trigger: deleteTokenMutation,
    reset: resetDeleteTokenMutation,
    isMutating: isDeletingToken,
    error: errorDeleteTokenMutation,
    data: deletedToken,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteToken'] : null,
    async ([authToken], { arg }: { arg: DeleteTokenInput }) =>
      deleteTokenAction(arg, { authToken }),
  );

  return {
    createToken: createTokenMutation,
    resetCreateTokenMutation,
    isCreatingToken,
    errorCreateTokenMutation,
    createdToken,

    deleteToken: deleteTokenMutation,
    resetDeleteTokenMutation,
    isDeletingToken,
    errorDeleteTokenMutation,
    deletedToken,
  };
};
