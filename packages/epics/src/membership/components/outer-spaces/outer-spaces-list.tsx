import { FC } from 'react';
import { OuterSpaceCard } from './outer-space-card';
import { useOuterSpaces } from '../../hooks/use-outer-spaces';

type OuterSpacesListProps = {
  page: number;
  activeSort: string;
};

export const OuterSpacesList: FC<OuterSpacesListProps> = ({
  page,
  activeSort,
}) => {
  const { outerSpaces, isLoading } = useOuterSpaces({
    page,
    sort:
      activeSort === 'all'
        ? { sort: 'all' }
        : activeSort === 'most-recent'
        ? { sort: 'most-recent' }
        : undefined,
  });
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {outerSpaces.map((outerSpace, index) => (
          <OuterSpaceCard key={index} {...outerSpace} isLoading={isLoading} />
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
