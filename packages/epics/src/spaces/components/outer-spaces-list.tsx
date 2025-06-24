import { FC } from 'react';
import { OuterSpaceCard } from './outer-space-card';
import { useSpaces } from '../hooks';
import { SortParams } from '@hypha-platform/graphql/rsc';

type OuterSpacesListProps = {
  page: number;
  activeSort: SortParams['sort'];
};

export const OuterSpacesList: FC<OuterSpacesListProps> = ({
  page,
  activeSort,
}) => {
  const { spaces, isLoading } = useSpaces({
    page,
    pageSize: 2,
    sort: { sort: activeSort },
  });
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {spaces.map((space) => (
          <OuterSpaceCard key={space.slug} {...space} isLoading={isLoading} />
        ))}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <OuterSpaceCard isLoading={isLoading} />
          <OuterSpaceCard isLoading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};
