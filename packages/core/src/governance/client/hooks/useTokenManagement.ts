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
      if (!res.ok) {
        throw new Error('Failed to fetch tokens');
      }
      const tokens = await res.json();
      return tokens;
    },
  );

  const { trigger: deleteToken, isMutating: isDeletingToken } = useSWRMutation(
    authToken ? [authToken, 'deleteToken'] : null,
    async ([authToken], { arg }: { arg: DeleteTokenInput }) => {
      try {
        const result = await deleteTokenAction(arg, { authToken });
        return result;
      } catch (error) {
        console.error('Token deletion failed:', error);
        throw error;
      }
    },
  );

  const { trigger: updateToken, isMutating: isUpdatingToken } = useSWRMutation(
    authToken ? [authToken, 'updateToken'] : null,
    async ([authToken], { arg }: { arg: UpdateTokenInput }) => {
      console.log('Updating token with input:', arg);
      try {
        const result = await updateTokenAction(arg, { authToken });
        console.log('Token update successful:', result);
        return result;
      } catch (error) {
        console.error('Token update failed:', error);
        throw error;
      }
    },
  );

  return {
    fetchTokens,
    deleteToken,
    updateToken,
    isDeletingToken,
    isUpdatingToken,
  };
};
