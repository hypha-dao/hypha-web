'use client';

import { useTokens } from '@hypha-platform/epics';
import { Image } from '@hypha-platform/ui';

interface TokenLabelProps {
  tokenAddress: `0x${string}`;
}

export const TokenLabel = ({ tokenAddress }: TokenLabelProps) => {
  const { tokens } = useTokens();
  const token = tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  if (!token) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Image
          src={token.icon}
          alt={token.symbol}
          width={16}
          height={16}
          className="rounded-full"
        />
        <div className="text-1 text-neutral-9">{token.symbol}</div>
      </div>
    </div>
  );
};
