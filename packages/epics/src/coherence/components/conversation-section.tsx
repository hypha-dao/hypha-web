'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui';
import { Coherence } from '../types';
import { ConversationGridContainer } from './conversation-grid.container';
import { useConversationsSection } from '../hooks/use-conversations-section';
import { Empty } from '../../common';
import { DirectionType } from '@hypha-platform/core/client';

type ConversationSectionProps = {
  conversations: Coherence[];
  label?: string;
  hasSearch?: boolean;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
};

export const ConversationSection: FC<ConversationSectionProps> = ({
  conversations,
  label,
  hasSearch = false,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
}) => {
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredConversations,
  } = useConversationsSection({
    conversations,
    firstPageSize,
    pageSize,
  });

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        searchPlaceholder="Search conversation"
        onChangeSearch={onUpdateSearch}
        inlineLabel={false}
      ></SectionFilter>

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <ConversationGridContainer
              key={index}
              conversations={filteredConversations}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'id',
                  },
                ],
              }}
            />
          ))}
        </div>
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text>
            {pagination?.totalPages === pages ? 'No more' : 'Load more'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
