import { FC } from 'react';
import { ProposalCard } from './proposal-card';
import { ProposalLoadMore } from './proposals-load-more';

type ProposalItem = {
  title: string;
  creator: { avatar: string; name: string; surname: string };
  commitment: number;
  status: string;
};

type ProposalListProps = {
  proposals: ProposalItem[];
  onLoadMore: () => void;
  isLoading: boolean | undefined;
};

const ProposalList: FC<ProposalListProps> = ({
  proposals,
  onLoadMore,
  isLoading,
}) => {
  return (
    <div className="proposal-list w-full">
      {isLoading ? (
        <div>
          <ProposalCard isLoading={isLoading} />
          <ProposalCard isLoading={isLoading} />
          <ProposalCard isLoading={isLoading} />
          <ProposalCard isLoading={isLoading} />
        </div>
      ) : (
        proposals.map((proposal, index) => (
          <ProposalCard key={index} {...proposal} isLoading={isLoading} />
        ))
      )}
      {}
      <ProposalLoadMore onClick={onLoadMore} label="Load more proposals" />
    </div>
  );
};

export default ProposalList;
