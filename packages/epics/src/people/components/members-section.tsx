'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

import { MembersList } from './members-list';
import { useMembersSection } from '../hooks/use-members-section';
import { UseMembers } from '../hooks/types';
import { Empty } from '../../common';
import { Button } from '@hypha-platform/ui';

type MemberSectionProps = {
  basePath: string;
  useMembers: UseMembers;
  spaceSlug?: string;
  refreshInterval?: number;
};

export const MembersSection: FC<MemberSectionProps> = ({
  basePath,
  useMembers,
  spaceSlug,
  refreshInterval,
}) => {
  const { pages, isLoading, loadMore, pagination, onUpdateSearch, searchTerm } =
    useMembersSection({
      useMembers,
      spaceSlug,
      refreshInterval,
    });
  console.debug('MembersSection', { searchTerm });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <span className="w-full flex">
        <SectionFilter
          count={pagination?.total || 0}
          label="Members"
          hasSearch
          searchPlaceholder="Search members"
          onChangeSearch={onUpdateSearch}
        />
        <Button>Delegate Voting</Button>
      </span>
      {pagination?.total === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <MembersList
            basePath={basePath}
            page={index + 1}
            key={index}
            useMembers={useMembers}
            spaceSlug={spaceSlug}
            searchTerm={searchTerm}
            refreshInterval={refreshInterval}
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
