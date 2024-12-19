'use client';
import { FC } from 'react';
import { AssetsList } from './assets-list';
import { Text } from '@radix-ui/themes';
import { useAssetsSection } from '../../hooks/use-assets-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

type AssetSectionProps = Record<string, never>;

export const AssetsSection: FC<AssetSectionProps> = () => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    filterOptions,
    totalBalance,
  } = useAssetsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={totalBalance || 0}
        label="Balance"
        sortOptions={sortOptions}
      >
        <Button className="ml-2" size="sm">
          <PlusIcon className="mr-2" />
          Add Wallet
        </Button>
      </SectionFilter>
      <SectionTabs
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        tabs={filterOptions}
      />
      {Array.from({ length: pages }).map((_, index) => (
        <AssetsList page={index + 1} key={index} activeFilter={activeFilter} />
      ))}
      <SectionLoadMore
        onClick={loadMore}
        disabled={pagination?.totalPages === pages}
        isLoading={isLoading}
      >
        <Text>
          {pagination?.totalPages === pages
            ? 'No more assets'
            : 'Load more assets'}
        </Text>
      </SectionLoadMore>
    </div>
  );
};
