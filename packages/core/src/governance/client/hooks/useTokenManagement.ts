import useSWRMutation from 'swr/mutation';
import { DbToken } from '@hypha-platform/core/client';
import { deleteTokenAction, updateTokenAction } from '../../server/actions';
import { DeleteTokenInput, UpdateTokenInput } from '../../types';

export const useTokenManagement = ({
  tokenSymbol,
  authToken,
}: {
  tokenSymbol?: string | null;
  authToken?: string | null;
}) => {
  const { trigger: fetchTokens } = useSWRMutation<DbToken[]>(
    ['findAllTokens', tokenSymbol],
    async () => {
      const res = await fetch(
        `/api/v1/tokens?search=${encodeURIComponent(tokenSymbol ?? '')}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      if (!res.ok) throw new Error('Failed to fetch tokens');
      return res.json();
    },
  );

  const { trigger: deleteToken, isMutating: isDeletingToken } = useSWRMutation(
    authToken ? [authToken, 'deleteToken'] : null,
    async ([authToken], { arg }: { arg: DeleteTokenInput }) =>
      deleteTokenAction(arg, { authToken }),
  );

  const { trigger: updateToken, isMutating: isUpdatingToken } = useSWRMutation(
    authToken ? [authToken, 'updateToken'] : null,
    async ([authToken], { arg }: { arg: UpdateTokenInput }) =>
      updateTokenAction(arg, { authToken }),
  );

  return {
    fetchTokens,
    deleteToken,
    updateToken,
    isDeletingToken,
    isUpdatingToken,
  };
};
