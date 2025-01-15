import { FC } from 'react';
import { AgreementCard } from './agreement-card';
import { useAgreements } from '../hooks/use-agreements';
import Link from 'next/link';
import { AgreementItem } from '@hypha-platform/graphql/rsc';

type AgreementsListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
  agreementsProp?: AgreementItem[];
  withoutAvatar?: boolean;
};

export const AgreementsList: FC<AgreementsListProps> = ({
  page,
  activeFilter,
  basePath,
  agreementsProp,
  withoutAvatar,
}) => {
  const { agreements, isLoading } = useAgreements({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="agreement-list w-full">
      {(agreementsProp ? agreementsProp : agreements).map(
        (agreement, index) => (
          <Link
            href={`${basePath}/${agreement.slug}`}
            key={index}
            scroll={false}
          >
            <AgreementCard
              withoutAvatar={withoutAvatar}
              key={index}
              {...agreement}
              isLoading={isLoading}
            />
          </Link>
        )
      )}
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
