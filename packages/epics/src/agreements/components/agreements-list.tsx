import { FC } from 'react';
import { AgreementCard } from './agreement-card';
import { useAgreements } from '../hooks/use-agreements';
import Link from 'next/link';

type AgreementsListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
};

export const AgreementsList: FC<AgreementsListProps> = ({
  page,
  activeFilter,
  basePath,
}) => {
  const { agreements, isLoading } = useAgreements({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="agreement-list w-full">
      {agreements.map((agreement, index) => (
        <Link href={`${basePath}/${agreement.slug}`} key={index}>
          <AgreementCard key={index} {...agreement} isLoading={isLoading} />
        </Link>
      ))}
      {isLoading ? (
        <div>
          <AgreementCard isLoading={isLoading} />
          <AgreementCard isLoading={isLoading} />
          <AgreementCard isLoading={isLoading} />
          <AgreementCard isLoading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};
