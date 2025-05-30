'use client';

interface ProposalMintItemProps {
  member: `0x${string}`;
  number: bigint;
}

export const ProposalMintItem = ({ member, number }: ProposalMintItemProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 w-full">{member}</div>
        <div className="text-1">{number}</div>
      </div>
    </div>
  );
};
