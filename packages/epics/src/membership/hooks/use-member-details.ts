'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AgreementItem } from '@hypha-platform/graphql/rsc';

export const useMemberDetails = (agreements: AgreementItem[]) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const agreementsPerPage = 4;

  const filteredAgreements = useMemo(() => {
    return agreements.filter((agreement) =>
      activeFilter === 'all' ? true : agreement.status === activeFilter
    );
  }, [agreements, activeFilter]);

  const paginatedAgreements = useMemo(() => {
    return filteredAgreements.slice(0, pages * agreementsPerPage);
  }, [filteredAgreements, pages]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredAgreements.length / agreementsPerPage);
  }, [filteredAgreements]);

  const pagination = useMemo(
    () => ({
      totalPages,
      hasNextPage: pages < totalPages,
    }),
    [totalPages, pages]
  );

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
