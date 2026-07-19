'use client';

import { parseUnits } from 'viem';
import { erc20Abi } from 'viem';
import { useReadContract } from 'wagmi';
import type { ProposeContributionMetadata } from '@hypha-platform/core/client';
import { ProposalTransactionItem } from './proposal-transaction-item';

type MetadataPayoutRowProps = {
  payout: { amount: string; token: string };
  recipient: string;
  spaceSlug: string;
};

function MetadataPayoutRow({
  payout,
  recipient,
  spaceSlug,
}: MetadataPayoutRowProps) {
  const { data: decimalsData } = useReadContract({
    address: payout.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const decimals =
    decimalsData && typeof decimalsData === 'number' ? decimalsData : 18;

  let rawAmount: bigint | undefined;
  try {
    rawAmount = parseUnits(payout.amount, decimals);
  } catch {
    return null;
  }

  return (
    <ProposalTransactionItem
      recipient={recipient}
      amount={rawAmount}
      tokenAddress={payout.token}
      spaceSlug={spaceSlug}
    />
  );
}

type ProposalContributionPaymentFromMetadataProps = {
  contribution: ProposeContributionMetadata;
  spaceSlug: string;
};

export function ProposalContributionPaymentFromMetadata({
  contribution,
  spaceSlug,
}: ProposalContributionPaymentFromMetadataProps) {
  return (
    <>
      {contribution.payouts.map((payout, index) => (
        <MetadataPayoutRow
          key={`${payout.token}-${index}`}
          payout={payout}
          recipient={contribution.recipient}
          spaceSlug={spaceSlug}
        />
      ))}
    </>
  );
}
