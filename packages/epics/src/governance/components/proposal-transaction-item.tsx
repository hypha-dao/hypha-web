'use client';

import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { Image } from '@hypha-platform/ui';
import { EthAddress } from '../../people';
import { useTokens } from '../../agreements/plugins/hooks';

interface ProposalTransactionItemProps {
  recipient?: string;
  amount?: bigint;
  tokenAddress?: string;
}

export const ProposalTransactionItem = ({
  recipient,
  amount,
  tokenAddress,
}: ProposalTransactionItemProps) => {
  const { tokens } = useTokens();
  const token = tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const { data: decimalsData, isError } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const decimals =
    decimalsData && typeof decimalsData === 'number' ? decimalsData : 18;

  if (!token || !amount || isError || !decimalsData) return null;

  const parsedAmount = Number(amount) / 10 ** decimals;
  const formattedAmount = parsedAmount.toFixed(decimals);

  return (
    <div className="w-full flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Image
          src={token.icon}
          alt={token.symbol}
          width={24}
          height={24}
          className="rounded-full"
        />
        <div className="text-sm font-medium text-neutral-9">
          {formattedAmount} {token.symbol}
        </div>
      </div>
      <div className="w-[140px]">
        <EthAddress address={recipient || ''} />
      </div>
    </div>
  );
};
