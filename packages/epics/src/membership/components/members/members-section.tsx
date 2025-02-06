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
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

type MemberSectionProps = {
  basePath?: string;
};

export const MembersSection: FC<MemberSectionProps> = ({ basePath }) => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    filterOptions,
    members,
  } = useMembersSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={members?.length || 0}
        label="Members"
        sortOptions={sortOptions}
      >
        <Button className="ml-2">
          <PlusIcon className="mr-2" />
          Invite member
        </Button>
      </SectionFilter>
      {members?.length === 0 ? null : (
        <SectionTabs
          activeTab={activeFilter}
          setActiveTab={setActiveFilter}
          tabs={filterOptions}
        />
      )}
      {members?.length === 0 ? (
        <Text className="text-neutra-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <MembersList
            basePath={basePath}
            page={index + 1}
            key={index}
            activeFilter={activeFilter}
          />
        ))
      )}
      {members?.length === 0 ? null : (
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
      )}
    </div>
  );
};
