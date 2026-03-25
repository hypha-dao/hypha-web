'use client';

import useSWRMutation from 'swr/mutation';
import {
  CreateTokenInput,
  DeleteTokenInput,
  UpdateTokenInput,
  CreateTokenUpdateInput,
} from '../../types';
import {
  createTokenAction,
  deleteTokenAction,
  updateTokenAction,
  createTokenUpdateAction,
  applyTokenUpdateAction,
  deleteTokenUpdateAction,
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

  const {
    trigger: createTokenUpdateMutation,
    reset: resetCreateTokenUpdateMutation,
    isMutating: isCreatingTokenUpdate,
    error: errorCreateTokenUpdateMutation,
    data: createdTokenUpdate,
  } = useSWRMutation(
    authToken ? [authToken, 'createTokenUpdate'] : null,
    async ([authToken], { arg }: { arg: CreateTokenUpdateInput }) =>
      createTokenUpdateAction(arg, { authToken }),
  );

  const {
    trigger: applyTokenUpdateMutation,
    reset: resetApplyTokenUpdateMutation,
    isMutating: isApplyingTokenUpdate,
    error: errorApplyTokenUpdateMutation,
    data: appliedTokenUpdate,
  } = useSWRMutation(
    authToken ? [authToken, 'applyTokenUpdate'] : null,
    async ([authToken], { arg }: { arg: number }) =>
      applyTokenUpdateAction(arg, { authToken }),
  );

  const {
    trigger: deleteTokenUpdateMutation,
    reset: resetDeleteTokenUpdateMutation,
    isMutating: isDeletingTokenUpdate,
    error: errorDeleteTokenUpdateMutation,
    data: deletedTokenUpdate,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteTokenUpdate'] : null,
    async ([authToken], { arg }: { arg: number }) =>
      deleteTokenUpdateAction(arg, { authToken }),
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

    createTokenUpdate: createTokenUpdateMutation,
    resetCreateTokenUpdateMutation,
    isCreatingTokenUpdate,
    errorCreateTokenUpdateMutation,
    createdTokenUpdate,

    applyTokenUpdate: applyTokenUpdateMutation,
    resetApplyTokenUpdateMutation,
    isApplyingTokenUpdate,
    errorApplyTokenUpdateMutation,
    appliedTokenUpdate,

    deleteTokenUpdate: deleteTokenUpdateMutation,
    resetDeleteTokenUpdateMutation,
    isDeletingTokenUpdate,
    errorDeleteTokenUpdateMutation,
    deletedTokenUpdate,
  };
};
