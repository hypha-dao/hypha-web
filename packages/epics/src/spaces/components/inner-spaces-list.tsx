import { FC } from 'react';
import { InnerSpaceCard } from './inner-space-card';
import { useSpaces } from '../hooks';
import { SortParams } from '@hypha-platform/graphql/rsc';
import Link from 'next/link';

type InnerSpacesListProps = {
  page: number;
  activeSort?: SortParams['sort'];
  basePath: string;
};

export const InnerSpacesList: FC<InnerSpacesListProps> = ({
  page,
  activeSort,
  basePath,
}) => {
  const { spaces, isLoading } = useSpaces({
    page,
    pageSize: 3,
    sort: { sort: activeSort },
  });
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
        {spaces.map((space) => (
          <Link
            href={`${basePath}/${space.slug}`}
            key={space.slug}
            scroll={false}
          >
            <InnerSpaceCard {...space} isLoading={isLoading} />
          </Link>
        ))}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <InnerSpaceCard isLoading={isLoading} />
          <InnerSpaceCard isLoading={isLoading} />
          <InnerSpaceCard isLoading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};
