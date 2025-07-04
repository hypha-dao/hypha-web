'use client';

interface ProposalEntryInfoProps {
  joinMethod: bigint;
}

const getEntryMethodLabel = (method: bigint): string => {
  switch (method) {
    case 0n:
      return 'Open Access';
    case 1n:
      return 'Token Based';
    case 2n:
      return 'Invite Only';
    default:
      return 'Unknown';
  }
};

export const ProposalEntryInfo = ({ joinMethod }: ProposalEntryInfoProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Entry Method</div>
        <div className="text-1 text-nowrap">
          {getEntryMethodLabel(joinMethod)}
        </div>
      </div>
    </div>
  );
};
