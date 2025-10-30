'use client';

import { Image } from '@hypha-platform/ui';
import { DbToken } from '@hypha-platform/core/server';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';

interface ProposalTokenItemProps {
  name?: string;
  symbol?: string;
  initialSupply?: bigint;
  dbTokens?: DbToken[];
  address?: string;
}

export const ProposalTokenItem = ({
  name,
  symbol,
  initialSupply,
  dbTokens,
  address,
}: ProposalTokenItemProps) => {
  const originalSupply = initialSupply ? Number(initialSupply / 10n ** 18n) : 0;
  const { id } = useParams();
  const { space } = useSpaceBySlug(id as string);
  const tokenIcon = dbTokens?.find(
    (t) =>
      t.symbol?.toUpperCase() === symbol?.toUpperCase() &&
      t.name?.toUpperCase() === name?.toUpperCase() &&
      t.spaceId == space?.id,
  )?.iconUrl;
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
          src={tokenIcon || '/placeholder/neutral-token-icon.svg'}
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
