'use client';

import { Button, Separator, FilterMenu } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { MemberCardProps } from '../members/member-card';
import { MembersList } from '../members';
import { useSubspaceDetails } from '../../hooks/use-subspace-details';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import Link from 'next/link';

type SubspaceDetailProps = {
  title?: string;
  image?: string;
  content?: string;
  members?: MemberCardProps[];
  closeUrl?: string;
};

export const SubspaceDetail = ({
  title,
  image,
  content,
  members,
  closeUrl,
}: SubspaceDetailProps) => {
  const { isLoading, loadMore, pagination, activeFilter, setActiveFilter } =
    useSubspaceDetails(members ?? []);

  const filterSettings = {
    value: activeFilter,
    options: [
      { label: 'All', value: 'all' },
      { label: 'Most recent', value: 'most-recent' },
    ],
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <div className="text-4 font-medium flex items-center">{title}</div>
        <Link href={closeUrl ?? ''}>
          <Button variant="ghost" colorVariant="neutral">
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <img
        className="rounded-xl max-h-[150px] w-full object-cover"
        src={image ?? ''}
        alt={title ?? ''}
      />
      <div className="text-2 text-gray-500">{content}</div>
      <Separator />
      <div className="flex justify-between">
        <div className="text-4 font-medium">Members</div>
        <FilterMenu
          value={filterSettings.value}
          onChange={setActiveFilter}
          options={filterSettings.options}
        />
      </div>
      <MembersList
        page={pagination.totalPages}
        activeFilter={activeFilter}
        isLoadingProp={isLoading}
        minimize={true}
      />
      <SectionLoadMore
        onClick={loadMore}
        disabled={!pagination.hasNextPage}
        isLoading={isLoading}
      >
        {!pagination.hasNextPage ? 'No more members' : 'Load more members'}
      </SectionLoadMore>
    </div>
  );
};
