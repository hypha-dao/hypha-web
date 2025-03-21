import React from 'react';
import { SORT_OPTIONS } from '../../common/constants';
import { DocumentState, UseDocuments } from '../../governance';

const sortOptions = SORT_OPTIONS;

export const tabs = [
  {
    label: 'All',
    value: 'all',
  },
  {
    label: 'Hypha Space',
    value: 'hypha-space',
  },
  {
    label: 'EOS Space',
    value: 'eos-space',
  },
  {
    label: 'Hypha Energy',
    value: 'hypha-energy',
  },
];

export const useDocumentsSection = ({
  useDocuments,
  documentState,
}: {
  useDocuments: UseDocuments;
  documentState: DocumentState;
}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState('all');

  const { isLoading, pagination } = useDocuments({
    page: pages,
    pageSize: 3,
    filter: { state: documentState },
  });

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, pagination?.hasNextPage, setPages]);

  return {
    isLoading,
    loadMore,
    pagination,
    pages,
    setPages,
    activeFilter,
    setActiveFilter,
    sortOptions,
    tabs,
    activeTab,
    setActiveTab,
  };
};
