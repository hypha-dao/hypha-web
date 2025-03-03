'use client';

import { Document } from '@hypha-platform/core';
import React from 'react';
import useSWR from 'swr';

type UseDocumentBySlugReturn = {
  document?: Document;
  isLoading: boolean;
};

export const useDocumentBySlug = (
  documentSlug: string,
): UseDocumentBySlugReturn => {
  const endpoint = React.useMemo(
    () => `/api/v1/documents/${documentSlug}/`,
    [documentSlug],
  );
  const { data: document, isLoading } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => res.json()),
  );

  console.debug('useDocumentBySlug', { endpoint, document });
  return { document, isLoading };
};
