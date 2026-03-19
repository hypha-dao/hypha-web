'use client';

import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';

export const useWithdrawProposal = ({
  proposalId,
}: {
  proposalId?: number | null;
}) => {
  const { address } = useAccount();
  const { client } = useSmartWallets();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const withdrawProposal = useCallback(async () => {
    if (!client) throw new Error('Smart wallet not connected');
    if (!address) throw new Error('Wallet not connected');
    if (proposalId == null) throw new Error('Proposal ID is required');

    setIsWithdrawing(true);
    try {
      return await client.writeContract({
        address: daoProposalsImplementationConfig.address[8453],
        abi: daoProposalsImplementationConfig.abi,
        functionName: 'withdrawProposal',
        args: [BigInt(proposalId)],
      });
    } finally {
      setIsWithdrawing(false);
    }
  }, [address, client, proposalId]);

  return {
    withdrawProposal,
    isWithdrawing,
  };
};
