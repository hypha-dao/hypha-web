import { FC } from 'react';
import { ProposalCard } from './proposal-card';
import Link from 'next/link';
import { UseDocuments } from '../../governance';

type ProposalListProps = {
  page: number;
  basePath: string;
  useDocuments: UseDocuments;
  gridView: boolean;
};

export const ProposalList: FC<ProposalListProps> = ({
  page,
  basePath,
  useDocuments,
  gridView,
}) => {
  const { documents: proposals, isLoading } = useDocuments({
    page,
    filter: { state: 'proposal' },
  });

  const renderCards = () => {
    return proposals.map((proposal) => (
      <Link
        href={`${basePath}/${proposal.slug}`}
        key={proposal.slug}
        scroll={false}
      >
        <ProposalCard {...proposal} isLoading={isLoading} />
      </Link>
    ));
  };

  const renderSkeletons = () => {
    const skeletonsCount = gridView ? 3 : 4;
    return Array.from({ length: skeletonsCount }).map((_, index) => (
      <ProposalCard
        key={`skeleton-${index}`}
        isLoading={true}
        gridView={gridView}
      />
    ));
  };

  return (
    <div className="proposal-list w-full">
      {gridView ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          {renderCards()}
          {isLoading && renderSkeletons()}
        </div>
      ) : (
        <div>
          {renderCards()}
          {isLoading && renderSkeletons()}
        </div>
      )}
    </div>
  );
};
