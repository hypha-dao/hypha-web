'use client';

import { Document, fetchJson, POLL } from '@hypha-platform/core/client';
import React from 'react';
import useSWR, { mutate } from 'swr';

type UseDocumentBySlugReturn = {
  document?: Document;
  isLoading: boolean;
  mutate: () => void;
};

export const useDocumentBySlug = (
  documentSlug: string,
): UseDocumentBySlugReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/documents/${documentSlug}/`,
    [documentSlug],
  );
  const { data: document, isLoading } = useSWR(
    [endpoint],
    ([endpoint]) => fetchJson<Document>(endpoint, undefined, 'document'),
    {
      revalidateOnFocus: true,
      refreshInterval: POLL.ACTIVE,
      refreshWhenHidden: false,
    },
  );
  const manualMutate = React.useCallback(() => {
    mutate([endpoint]);
  }, [endpoint]);

  return { document, isLoading, mutate: manualMutate };
};
