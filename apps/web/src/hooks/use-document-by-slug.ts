'use client';

import { Document } from '@hypha-platform/core/client';
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
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
      refreshWhenHidden: false,
    },
  );
  const manualMutate = React.useCallback(() => {
    mutate([endpoint]);
  }, [endpoint]);

  return { document, isLoading, mutate: manualMutate };
};
