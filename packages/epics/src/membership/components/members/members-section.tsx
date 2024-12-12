'use client';
import { FC } from 'react';
import { MembersList } from './members-list';
import { Text } from '@radix-ui/themes';
import { useMembersSection } from '../../hooks/use-members-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';

type MemberSectionProps = Record<string, never>;

export const MembersSection: FC<MemberSectionProps> = () => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    filterOptions,
    tabs,
  } = useMembersSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label="Members"
        filterOptions={filterOptions}
      />
      <SectionTabs
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        tabs={tabs}
      />
      {Array.from({ length: pages }).map((_, index) => (
        <MembersList page={index + 1} key={index} activeFilter={activeFilter} />
      ))}
      <SectionLoadMore
        onClick={loadMore}
        disabled={pagination?.totalPages === pages}
        isLoading={isLoading}
      >
        <Text>
          {pagination?.totalPages === pages
            ? 'No more members'
            : 'Load more members'}
        </Text>
      </SectionLoadMore>
    </div>
  );
};
