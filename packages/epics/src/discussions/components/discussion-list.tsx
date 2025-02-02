import { FC } from 'react';
import { DiscussionCard } from './discussion-card';
import { useDiscussions } from '../hooks/use-discussions';
import Link from 'next/link';

type DiscussionsListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
};

export const DiscussionsList: FC<DiscussionsListProps> = ({
  page,
  activeFilter,
  basePath,
}) => {
  const { discussions, isLoading } = useDiscussions({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
        {discussions.map((discussion) => (
          <Link href={`${basePath}/${discussion.slug}`} key={discussion.slug}>
            <DiscussionCard {...discussion} isLoading={isLoading} />
          </Link>
        ))}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <DiscussionCard isLoading={isLoading} />
          <DiscussionCard isLoading={isLoading} />
          <DiscussionCard isLoading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};
