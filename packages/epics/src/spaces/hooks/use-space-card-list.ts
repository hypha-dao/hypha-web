import { Space } from '@core/space';
import React from 'react';

export const useSpaceCardList = ({ spaces }: { spaces: Space[] }) => {
  const [pages, setPages] = React.useState(1);

  const pagination = React.useMemo(() => {
    const pageSize = 3;
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
  }, [spaces, pages]);

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
