'use client';

import { Image, Button, Separator, FilterMenu } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { MembersList } from '../../people';
import { useSubspaceDetails } from '../hooks';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import Link from 'next/link';
import { type UseMembers } from '../hooks/types';
import { Empty } from "../../common";

type SubspaceDetailProps = {
  title?: string;
  image?: string;
  content?: string;
  closeUrl?: string;
  memberBasePath: string;
  useMembers: UseMembers;
};

export const SubspaceDetail = ({
  title,
  image,
  content,
  closeUrl,
  memberBasePath,
  useMembers,
}: SubspaceDetailProps) => {
  const { isLoading, loadMore, pages, pagination, activeFilter } =
    useSubspaceDetails({ useMembers });

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
        <Link href={closeUrl ?? ''} scroll={false}>
          <Button variant="ghost" colorVariant="neutral">
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <Image
        className="rounded-xl max-h-[150px] w-full object-cover"
        src={image ?? ''}
        alt={title ?? ''}
        width={1200}
        height={400}
      />
      <div className="text-2 text-gray-500">{content}</div>
      <Separator />
      <div className="flex justify-between">
        <div className="text-4 font-medium">Members</div>
        <FilterMenu value={'all'} options={filterSettings.options} />
      </div>
      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <MembersList
            key={index}
            page={index + 1}
            minimize={true}
            basePath={memberBasePath}
            useMembers={useMembers}
          />
        ))
      )}
      <SectionLoadMore
        onClick={loadMore}
        disabled={!pagination?.hasNextPage}
        isLoading={isLoading}
      >
        {!pagination?.hasNextPage ? 'No more members' : 'Load more members'}
      </SectionLoadMore>
    </div>
  );
};
