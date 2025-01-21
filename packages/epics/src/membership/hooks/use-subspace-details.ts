'use client';
import { useState, useEffect, useCallback } from 'react';
import { MemberCardProps } from '../components';

export const useSubspaceDetails = (members: MemberCardProps[]) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const membersPerPage = 4;

  const filteredMembers = members.filter((member) =>
    activeFilter === 'all' ? true : member.status === activeFilter
  );

  const paginatedMembers = filteredMembers.slice(0, pages * membersPerPage);

  const totalPages = Math.ceil(filteredMembers.length / membersPerPage);

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
    paginatedMembers,
    activeFilter,
    setActiveFilter,
  };
};
