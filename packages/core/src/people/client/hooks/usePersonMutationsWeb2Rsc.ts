'use client';

import useSWRMutation from 'swr/mutation';

import { EditPersonInput } from '../../types';
import { editPersonAction } from '@hypha-platform/core/people/server/actions';

export const usePersonMutationsWeb2Rsc = (authToken?: string | null) => {
  const {
    trigger: editPersonMutation,
    reset: resetEditPersonMutation,
    isMutating: isEditingPerson,
    error: errorEditPersonMutation,
    data: editedPerson,
  } = useSWRMutation(
    authToken ? [authToken, 'editPerson'] : null,
    async ([authToken], { arg }: { arg: EditPersonInput }) =>
      editPersonAction(arg, { authToken }),
  );

  return {
    editPerson: editPersonMutation,
    resetEditPersonMutation,
    isEditingPerson,
    errorEditPersonMutation,
    editedPerson,
  };
};
