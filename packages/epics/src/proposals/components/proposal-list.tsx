import { FC } from 'react';
import { ProposalCard } from './proposal-card';
import { useProposals } from '../hooks/use-proposals';
import Link from 'next/link';

type ProposalListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
};

export const ProposalList: FC<ProposalListProps> = ({
  page,
  activeFilter,
  basePath,
}) => {
  const { proposals, isLoading } = useProposals({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="proposal-list w-full">
      {proposals.map((proposal, index) => (
        <Link href={`${basePath}/${proposal.slug}`} key={index} scroll={false}>
          <ProposalCard key={index} {...proposal} isLoading={isLoading} />
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
