import { FC } from 'react';
import { ProposalCard } from './proposal-card';
import Link from 'next/link';
import { UseDocuments } from '../../governance';

type ProposalListProps = {
  page: number;
  basePath: string;
  useDocuments: UseDocuments;
};

export const ProposalList: FC<ProposalListProps> = ({
  page,
  basePath,
  useDocuments,
}) => {
  const { documents: proposals, isLoading } = useDocuments({
    page,
    filter: { state: 'proposal' },
  });
  return (
    <div className="proposal-list w-full">
      {proposals.map((proposal) => (
        <Link
          href={`${basePath}/${proposal.slug}`}
          key={proposal.slug}
          scroll={false}
        >
          <ProposalCard {...proposal} isLoading={isLoading} />
        </Link>
      ))}
      {isLoading ? (
        <div>
          <ProposalCard isLoading={isLoading} />
          <ProposalCard isLoading={isLoading} />
          <ProposalCard isLoading={isLoading} />
          <ProposalCard isLoading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};
