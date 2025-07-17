'use client';

import { Space } from '@hypha-platform/core/client';
import React from 'react';

export const useSpaceCardList = ({
  spaces,
  pageSize = 3,
}: {
  spaces: Space[];
  pageSize?: number;
}) => {
  const [pages, setPages] = React.useState(1);

  const pagination = React.useMemo(() => {
    const total = spaces.length;
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = pages < totalPages;

    return {
      page: pages,
      pageSize,
      total,
      totalPages,
      hasNextPage,
    };
  }, [spaces, pages, pageSize]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages((prev) => prev + 1);
  }, [pagination?.hasNextPage]);

  return {
    isLoading: false,
    loadMore,
    pagination,
    pages,
    setPages,
  };
};
