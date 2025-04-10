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
import { CopyIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';

type AssetSectionProps = {
  basePath: string;
};

export const AssetsSection: FC<AssetSectionProps> = ({ basePath }) => {
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
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={totalBalance || 0}
        label="Balance"
        sortOptions={sortOptions}
      >
        <Button asChild className="ml-2">
          <Link href={`treasury/deposit`} scroll={false}>
            <CopyIcon />
            Deposit funds
          </Link>
        </Button>
      </SectionFilter>
      {pagination?.totalPages === 0 ? null : (
        <SectionTabs
          activeTab={activeFilter}
          setActiveTab={setActiveFilter}
          tabs={filterOptions}
        />
      )}
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutra-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <AssetsList
            basePath={basePath}
            page={index + 1}
            key={`${basePath}-${index + 1}`}
            activeFilter={activeFilter}
          />
        ))
      )}
      {pagination?.totalPages === 0 ? null : (
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
      )}
    </div>
  );
};
