'use client';

import { useSpaceDocuments } from '@web/hooks/use-space-documents';

export const Debug = () => {
  const response = useSpaceDocuments({
    page: 1,
    filter: { state: 'discussion' },
  });
  return <pre>{JSON.stringify(response, null, 2)}</pre>;
};
