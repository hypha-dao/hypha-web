'use client';

import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';

export const useProposalVoting = ({
  proposalId,
}: {
  proposalId?: number | null;
}) => {
  const { address } = useAccount();
  const { client } = useSmartWallets();
  const [isVoting, setIsVoting] = useState(false);
  const [isCheckingExpiration, setIsCheckingExpiration] = useState(false);

  const vote = useCallback(
    async (support: boolean) => {
      if (!client) throw new Error('Smart wallet not connected');
      if (!address) throw new Error('Wallet not connected');
      if (proposalId == null) throw new Error('Proposal ID is required');

      setIsVoting(true);
      try {
        return await client.writeContract({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'vote',
          args: [BigInt(proposalId), support],
        });
      } finally {
        setIsVoting(false);
      }
    },
    [address, client, proposalId],
  );

  const checkProposalExpiration = useCallback(async () => {
    if (!client) throw new Error('Smart wallet not connected');
    if (!address) throw new Error('Wallet not connected');
    if (proposalId == null) throw new Error('Proposal ID is required');

    setIsCheckingExpiration(true);
    try {
      return await client.writeContract({
        address: daoProposalsImplementationConfig.address[8453],
        abi: daoProposalsImplementationConfig.abi,
        functionName: 'triggerExecutionCheck',
        args: [BigInt(proposalId)],
      });
    } catch (err) {
      console.error('Error checking proposal expiration:', err);
      throw err;
    } finally {
      setIsCheckingExpiration(false);
    }
  }, [address, client, proposalId]);

  const handleAccept = () => vote(true);
  const handleReject = () => vote(false);
  const handleCheckProposalExpiration = checkProposalExpiration;

  return {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isVoting,
    isCheckingExpiration,
  };
};
