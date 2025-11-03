'use client';

import useSWRMutation from 'swr/mutation';
import {
  CreateTokenInput,
  DeleteTokenInput,
  UpdateTokenInput,
} from '../../types';
import {
  createTokenAction,
  deleteTokenAction,
  updateTokenAction,
} from '../../server/actions';

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
    trigger: updateTokenMutation,
    reset: resetUpdateTokenMutation,
    isMutating: isUpdatingToken,
    error: errorUpdateTokenMutation,
    data: updatedToken,
  } = useSWRMutation(
    authToken ? [authToken, 'updateToken'] : null,
    async ([authToken], { arg }: { arg: UpdateTokenInput }) =>
      updateTokenAction(arg, { authToken }),
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

    updateToken: updateTokenMutation,
    resetUpdateTokenMutation,
    isUpdatingToken,
    errorUpdateTokenMutation,
    updatedToken,

    deleteToken: deleteTokenMutation,
    resetDeleteTokenMutation,
    isDeletingToken,
    errorDeleteTokenMutation,
    deletedToken,
  };
};
