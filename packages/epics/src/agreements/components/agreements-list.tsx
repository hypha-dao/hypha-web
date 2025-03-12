import { AgreementCard } from './agreement-card';
import Link from 'next/link';
import { UseDocuments } from '../../governance';
import { FC } from 'react';

type AgreementsListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
  useDocuments: UseDocuments;
  gridView: boolean;
};

export const AgreementsList: FC<AgreementsListProps> = ({
  page,
  activeFilter,
  basePath,
  useDocuments,
  gridView,
}) => {
  const { documents: agreements, isLoading } = useDocuments({
    page,
    filter: { state: 'agreement' },
  });

  const renderCards = () => {
    return agreements.map((agreement) => (
      <Link
        href={`${basePath}/${agreement.slug}`}
        key={agreement.slug}
        scroll={false}
      >
        <AgreementCard {...agreement} isLoading={isLoading} />
      </Link>
    ));
  };

  const renderSkeletons = () => {
    const skeletonsCount = gridView ? 3 : 4;
    return Array.from({ length: skeletonsCount }).map((_, index) => (
      <AgreementCard key={`skeleton-${index}`} isLoading={true} />
    ));
  };

  return (
    <div className="agreement-list w-full">
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
