import { FC } from 'react';
import { InnerSpaceCard } from './inner-space-card';
import { useInnerSpaces } from '../../hooks/use-inner-spaces';

type InnerSpacesListProps = {
  page: number;
  activeSort: string;
};

export const InnerSpacesList: FC<InnerSpacesListProps> = ({
  page,
  activeSort,
}) => {
  const { innerSpaces, isLoading } = useInnerSpaces({
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
        {innerSpaces.map((innerSpace, index) => (
          <InnerSpaceCard key={index} {...innerSpace} isLoading={isLoading} />
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
