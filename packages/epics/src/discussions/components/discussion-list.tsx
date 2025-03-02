import { FC } from 'react';
import { DiscussionCard } from './discussion-card';
import Link from 'next/link';
import { UseDocuments } from '../../governance';

type DiscussionsListProps = {
  page: number;
  basePath: string;
  useDocuments: UseDocuments;
};

export const DiscussionsList: FC<DiscussionsListProps> = ({
  page,
  basePath,
  useDocuments,
}) => {
  const { documents: discussions, isLoading } = useDocuments({
    page,
    filter: { state: 'discussion' },
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
