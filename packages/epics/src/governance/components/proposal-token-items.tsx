'use client';

interface ProposalTokenItemProps {
  name?: string;
  symbol?: string;
  initialSupply?: bigint;
}

export const ProposalTokenItem = ({
  name,
  symbol,
  initialSupply,
}: ProposalTokenItemProps) => {
  const originalSupply = initialSupply ? Number(initialSupply / 10n ** 18n) : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Name</div>
        <div className="text-1">{name}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Symbol</div>
        <div className="text-1">{symbol}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Max.Supply</div>
        <div className="text-1">{originalSupply}</div>
      </div>
    </div>
  );
};
