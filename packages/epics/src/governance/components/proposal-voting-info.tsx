'use client';

interface ProposalVotingInfoProps {
  votingPowerSource: bigint;
  unity: bigint;
  quorum: bigint;
}

const getVotingMethodLabel = (source: bigint): string => {
  switch (source) {
    case 1n:
      return '1 Voice 1 Vote';
    case 2n:
      return '1 Member 1 Vote';
    case 3n:
      return '1 Token 1 Vote';
    default:
      return 'Unknown';
  }
};

export const ProposalVotingInfo = ({
  votingPowerSource,
  unity,
  quorum,
}: ProposalVotingInfoProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Voting Method</div>
        <div className="text-1 text-nowrap">
          {getVotingMethodLabel(votingPowerSource)}
        </div>
      </div>

      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">Unity</div>
        <div>{unity.toString()}%</div>
      </div>

      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">Quorum</div>
        <div>{quorum.toString()}%</div>
      </div>
    </div>
  );
};
