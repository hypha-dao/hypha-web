import { FC } from 'react';
import { ProposalCard } from './proposal-card';
import { useProposals } from '../hooks/use-proposals';

type ProposalListProps = {
  page: number;
  activeFilter: string;
};

export const ProposalList: FC<ProposalListProps> = ({ page, activeFilter }) => {
  const { proposals, isLoading } = useProposals({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="proposal-list w-full">
      {proposals.map((proposal, index) => (
        <ProposalCard key={index} {...proposal} isLoading={isLoading} />
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
