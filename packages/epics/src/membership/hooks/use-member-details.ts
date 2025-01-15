'use client';
import { useState, useEffect, useCallback } from 'react';
import { AgreementItem } from '@hypha-platform/graphql/rsc';

export const useMemberDetails = (agreements: AgreementItem[]) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const agreementsPerPage = 4;

  const filteredAgreements = agreements.filter((agreement) =>
    activeFilter === 'all' ? true : agreement.status === activeFilter
  );

  const paginatedAgreements = filteredAgreements.slice(
    0,
    pages * agreementsPerPage
  );

  const totalPages = Math.ceil(filteredAgreements.length / agreementsPerPage);

  const pagination = {
    totalPages,
    hasNextPage: pages < totalPages,
  };

  const loadMore = useCallback(() => {
    if (!pagination.hasNextPage) return;
    setIsLoading(true);
    setPages((prev) => prev + 1);
    setIsLoading(false);
  }, [pagination.hasNextPage]);

  useEffect(() => {
    setPages(1);
  }, [activeFilter]);

  return {
    isLoading,
    loadMore,
    pagination,
    paginatedAgreements,
    activeFilter,
    setActiveFilter,
  };
};
