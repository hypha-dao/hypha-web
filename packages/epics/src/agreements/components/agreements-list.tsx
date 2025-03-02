import { AgreementCard } from './agreement-card';
import Link from 'next/link';
import { UseDocuments } from '../../governance';
import { FC } from 'react';

type AgreementsListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
  hasAvatar?: boolean;
  useDocuments: UseDocuments;
};

export const AgreementsList: FC<AgreementsListProps> = ({
  page,
  activeFilter,
  basePath,
  hasAvatar,
  useDocuments,
}) => {
  const { documents: agreements, isLoading } = useDocuments({
    page,
    filter: { state: 'agreement' },
  });

  return (
    <div className="agreement-list w-full">
      {agreements.map((agreement) => (
        <Link
          href={`${basePath}/${agreement.slug}`}
          key={agreement.slug}
          scroll={false}
        >
          <AgreementCard
            hasAvatar={hasAvatar}
            {...agreement}
            isLoading={isLoading}
          />
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
