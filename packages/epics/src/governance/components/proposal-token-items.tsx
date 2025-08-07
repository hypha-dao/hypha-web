'use client';

import { Image } from '@hypha-platform/ui';
import { DbToken } from '@hypha-platform/core/server';

interface ProposalTokenItemProps {
  name?: string;
  symbol?: string;
  initialSupply?: bigint;
  dbTokens?: DbToken[];
}

export const ProposalTokenItem = ({
  name,
  symbol,
  initialSupply,
  dbTokens,
}: ProposalTokenItemProps) => {
  const originalSupply = initialSupply ? Number(initialSupply / 10n ** 18n) : 0;
  const tokenIcon = dbTokens?.find((t) => t.symbol === symbol)?.iconUrl;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Name</div>
        <div className="text-1 text-nowrap">{name}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Symbol</div>
        <div className="text-1">{symbol}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Icon</div>
        <Image
          className="rounded-full w-7 h-7"
          width={32}
          height={32}
          src={tokenIcon || '/placeholder/token-icon.png'}
          alt={`Token icon for ${symbol}`}
        />
      </div>
      {/* <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token Max.Supply</div>
        <div className="text-1">{Number(originalSupply).toFixed(2)}</div>
      </div> */}
    </div>
  );
};
