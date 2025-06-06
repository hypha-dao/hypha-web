'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

import { MembersList } from './members-list';
import { useMembersSection } from '../hooks/use-members-section';
import { UseMembers } from '../hooks/types';

type MemberSectionProps = {
  basePath: string;
  useMembers: UseMembers;
  spaceSlug?: string;
};

export const MembersSection: FC<MemberSectionProps> = ({
  basePath,
  useMembers,
  spaceSlug,
}) => {
  const { pages, isLoading, loadMore, pagination, onUpdateSearch, searchTerm } =
    useMembersSection({
      useMembers,
      spaceSlug,
    });
  console.debug('MembersSection', { searchTerm });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter
        count={pagination?.total || 0}
        label="Members"
        hasSearch
        onChangeSearch={onUpdateSearch}
      />

      {pagination?.total === 0 ? (
        <Text className="text-neutra-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <MembersList
            basePath={basePath}
            page={index + 1}
            key={index}
            useMembers={useMembers}
            spaceSlug={spaceSlug}
            searchTerm={searchTerm}
          />
        ))
      )}
      {pagination?.total === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={
            isLoading ||
            (pagination &&
              (pagination.totalPages === pages || !pagination.hasNextPage))
          }
          isLoading={isLoading}
        >
          <Text>
            {isLoading
              ? 'Loading…'
              : pagination &&
                (pagination.totalPages === pages || !pagination.hasNextPage)
              ? 'No more members'
              : 'Load more members'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
