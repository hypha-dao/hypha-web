'use client';

import React from 'react';
import useSWR from 'swr';
import queryString from 'query-string';

import { FilterParams } from '@hypha-platform/graphql/rsc';

import { useSpaceSlug } from './use-space-slug';
// TODO: #594 declare UI interface separately
import { Document } from '@hypha-platform/core/client';
import { UseDocuments, UseDocumentsReturn } from '@hypha-platform/epics';

export const useSpaceDocuments: UseDocuments = ({
  page = 1,
  pageSize = 4,
  filter,
  activeTab,
}: {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<Pick<Document, 'state'>>;
  activeTab?: string;
}): UseDocumentsReturn => {
  const spaceSlug = useSpaceSlug();

  const queryParams = React.useMemo(() => {
    const effectiveFilter = {
      page,
      pageSize,
      ...(filter ? { ...filter } : {}),
    };
    if (!effectiveFilter || Object.keys(effectiveFilter).length === 0)
      return '';
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, filter]);

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/documents${queryParams}`,
    [spaceSlug, page, queryParams],
  );

  const { data: response, isLoading } = useSWR(
    [endpoint],
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
    { revalidateOnFocus: true },
  );

  const getDocumentBadges = (document: Document) => {
    switch (document.state) {
      case 'proposal':
        return [
          {
            label: 'Proposal',
            className: 'capitalize',
            variant: 'solid',
            colorVariant: 'accent',
          },
          {
            label: 'On voting',
            className: 'capitalize',
            variant: 'outline',
            colorVariant: 'warn',
          },
        ];
      // TODO: added badges for other states when we have a completion state
    }
  };

  const parsedData = response?.data.map((document: Document) => {
    return {
      ...document,
      badges: getDocumentBadges(document),
    };
  });

  return {
    documents: parsedData || [],
    pagination: response?.pagination,
    isLoading,
  };
};
