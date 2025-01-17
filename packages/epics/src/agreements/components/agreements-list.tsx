import { FC } from 'react';
import { AgreementItem } from '@hypha-platform/graphql/rsc';
import { AgreementCard } from './agreement-card';
import Link from 'next/link';

type AgreementsListProps = {
  basePath: string;
  agreements?: AgreementItem[];
  isLoading?: boolean;
};

export const AgreementsList: FC<AgreementsListProps> = ({
  basePath,
  agreements,
  isLoading,
}) => {
  return (
    <div className="agreement-list w-full">
      {agreements?.map((agreement, index) => (
        <Link href={`${basePath}/${agreement.slug}`} key={index} scroll={false}>
          <AgreementCard key={index} {...agreement} isLoading={false} />
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
