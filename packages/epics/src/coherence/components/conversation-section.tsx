'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import {
  Checkbox,
  Combobox,
  SectionFilter,
  SectionLoadMore,
} from '@hypha-platform/ui';
import { COHERENCE_ORDERS, CoherenceOrder } from '../types';
import { ConversationGridContainer } from './conversation-grid.container';
import { useConversationsSection } from '../hooks/use-conversations-section';
import { Empty } from '../../common';
import { Coherence, DirectionType } from '@hypha-platform/core/client';
import React from 'react';

type ConversationSectionProps = {
  basePath: string;
  conversations: Coherence[];
  label?: string;
  hasSearch?: boolean;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
};

const orderOptions: {
  value: CoherenceOrder;
  label: string;
  searchText: string;
}[] = [
  {
    value: 'mostviews',
    label: 'Most Views',
    searchText: 'Most Members',
  },
  {
    value: 'mostmessages',
    label: 'Most Messages',
    searchText: 'Most Agreements',
  },
  {
    value: 'mostrecent',
    label: 'Most Recent',
    searchText: 'Most Recent',
  },
];

export const ConversationSection: FC<ConversationSectionProps> = ({
  basePath,
  conversations,
  label,
  hasSearch = false,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
}) => {
  const [order, setOrder] = React.useState<CoherenceOrder>('mostrecent');
  const [hideArchived, setHideArchived] = React.useState(true);

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
    hideArchived,
  });

  const updateOrder = (rawOrder: string) => {
    setOrder(
      COHERENCE_ORDERS.includes(rawOrder as CoherenceOrder)
        ? (rawOrder as CoherenceOrder)
        : 'mostrecent',
    );
  };

  return (
    <div className="flex flex-col justify-around items-center gap-4 w-full">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        searchPlaceholder="Search conversation"
        onChangeSearch={onUpdateSearch}
        inlineLabel={false}
        className="w-full items-end"
      >
        <div className="flex grow-1"></div>
        <div className="flex grow-0">
          <Combobox
            options={orderOptions}
            initialValue={order}
            className="border-0 md:w-40"
            onChange={updateOrder}
            allowEmptyChoice={false}
          />
        </div>
        <div className="flex flex-row gap-2 h-full">
          <Checkbox
            id="hideArchivedCheckbox"
            className="self-center"
            checked={hideArchived}
            onCheckedChange={(value) => {
              setHideArchived(value === true);
            }}
          />
          <label
            className="text-[14px] self-center"
            htmlFor="hideArchivedCheckbox"
          >
            Hide archived
          </label>
        </div>
      </SectionFilter>

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <ConversationGridContainer
              key={index}
              basePath={basePath}
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
