'use client';

import useSWR from 'swr';
import { getTokenUpdateByDocumentIdAction } from '../../server/actions';

export const useTokenUpdateByDocumentId = ({
  documentId,
  authToken,
}: {
  documentId?: number | null;
  authToken?: string;
}) => {
  const { data, isLoading, error, mutate } = useSWR(
    authToken &&
      documentId != null &&
      documentId > 0 &&
      Number.isFinite(documentId)
      ? [documentId, authToken, 'updateTokenByDocumentId']
      : null,
    async ([docId, token]) =>
      getTokenUpdateByDocumentIdAction(docId as number, {
        authToken: token as string,
      }),
    { refreshInterval: 10000 },
  );

  return { tokenUpdate: data ?? undefined, isLoading, error, mutate };
};
