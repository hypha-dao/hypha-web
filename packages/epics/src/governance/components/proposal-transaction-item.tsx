'use client';

import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { Image } from '@hypha-platform/ui';
import { EthAddress } from '../../people';
import { useTokens, usePersonByWeb3Address } from '@hypha-platform/epics';
import { Token } from '@hypha-platform/core/client';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useDbSpaces } from '@hypha-platform/epics';

interface ProposalTransactionItemProps {
  recipient?: string;
  amount?: bigint;
  tokenAddress?: string;
  spaceSlug: string;
}

export const ProposalTransactionItem = ({
  recipient,
  amount,
  tokenAddress,
  spaceSlug,
}: ProposalTransactionItemProps) => {
  if (!recipient) return null;
  const { spaces } = useDbSpaces({
    parentOnly: false,
  });
  const { person } = usePersonByWeb3Address(recipient as `0x${string}`);
  const { tokens } = useTokens({ spaceSlug });
  const token = tokens.find(
    (t: Token) => t.address.toLowerCase() === tokenAddress?.toLowerCase(),
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

  const space = spaces.find(
    (s) => s.address?.toLowerCase() === recipient.toLowerCase(),
  );

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
          {formatCurrencyValue(Number(formattedAmount))} {token.symbol}
        </div>
      </div>
      <div className="w-[140px]">
        {person ? (
          <span className="flex gap-2 text-2 text-neutral-11 justify-end">
            <Image
              className="rounded-lg w-[24px] h-[24px]"
              src={person?.avatarUrl ?? '/placeholder/default-profile.svg'}
              width={24}
              height={24}
              alt={`${person?.nickname} avatar`}
            />
            <span className="text-nowrap">
              {person?.name} {person?.surname}
            </span>
          </span>
        ) : space ? (
          <span className="flex gap-2 text-2 text-neutral-11 justify-end">
            <Image
              className="rounded-lg w-[24px] h-[24px]"
              src={space?.logoUrl ?? '/placeholder/default-profile.svg'}
              width={24}
              height={24}
              alt={`${space?.title} logo`}
            />
            <span className="text-nowrap">{space?.title}</span>
          </span>
        ) : (
          <EthAddress address={recipient || ''} />
        )}
      </div>
    </div>
  );
};
