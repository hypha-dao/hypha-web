'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Checkbox, Combobox, SectionLoadMore } from '@hypha-platform/ui';
import { COHERENCE_ORDERS, CoherenceOrder } from '../types';
import { ConversationGridContainer } from './conversation-grid.container';
import { useConversationsSection } from '../hooks/use-conversations-section';
import { Empty } from '../../common';
import { Coherence, DirectionType } from '@hypha-platform/core/client';
import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { ScreenToolbar } from '../../common/screen-toolbar';

type ConversationSectionProps = {
  basePath: string;
  conversations: Coherence[];
  hasSearch?: boolean;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
  hideArchived: boolean;
  order?: CoherenceOrder;
  setHideArchived: (checked: boolean) => void;
  refresh: () => Promise<void>;
};

const orderOptions: {
  value: CoherenceOrder;
  label: string;
  searchText: string;
}[] = [
  {
    value: 'mostviews',
    label: 'Most Views',
    searchText: 'Most Views',
  },
  {
    value: 'mostmessages',
    label: 'Most Messages',
    searchText: 'Most Messages',
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
  hasSearch = false,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
  hideArchived,
  order = 'mostrecent',
  setHideArchived,
  refresh,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

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

  const setOrder = React.useCallback(
    (rawOrder: string) => {
      const params = new URLSearchParams(searchParams);
      if (rawOrder) {
        const order = COHERENCE_ORDERS.includes(rawOrder as CoherenceOrder)
          ? (rawOrder as CoherenceOrder)
          : 'mostrecent';
        params.set('order_conv', order);
      } else {
        params.delete('order_conv');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  return (
    <div className="flex flex-col justify-around items-center gap-4 w-full">
      <ScreenToolbar
        center={
          hasSearch ? (
            <Input
              type="search"
              placeholder="Search conversation"
              onChange={(event) => onUpdateSearch(event.target.value)}
              leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
            />
          ) : null
        }
        right={
          <div className="flex flex-wrap items-center gap-3">
            <Combobox
              options={orderOptions}
              initialValue={order}
              className="border-0 md:w-40"
              onChange={setOrder}
              allowEmptyChoice={false}
              disabled={isLoading}
            />
            <div className="flex flex-row gap-2 h-full">
              <Checkbox
                id="hideArchivedCheckbox"
                className="self-center"
                checked={hideArchived}
                onCheckedChange={(value) => {
                  setHideArchived(value === true);
                }}
                disabled={isLoading}
              />
              <label
                className="text-[14px] self-center"
                htmlFor="hideArchivedCheckbox"
              >
                Hide archived
              </label>
            </div>
          </div>
        }
      />

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
              refresh={refresh}
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
