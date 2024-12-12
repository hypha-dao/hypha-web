import { FC } from 'react';
import { AgreementCard } from './agreement-card';
import { useAgreements } from '../hooks/use-agreements';

type AgreementsListProps = {
  page: number;
  activeFilter: string;
};

export const AgreementsList: FC<AgreementsListProps> = ({
  page,
  activeFilter,
}) => {
  const { agreements, isLoading } = useAgreements({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="agreement-list w-full">
      {agreements.map((agreement, index) => (
        <AgreementCard key={index} {...agreement} isLoading={isLoading} />
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
