'use client';

import { useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { daoProposalsImplementationConfig } from '@core/generated';

export const useVote = ({ proposalId }: { proposalId?: number | null }) => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const vote = useCallback(
    async (proposalId: number, support: boolean) => {
      if (!address) {
        throw new Error('Wallet not connected');
      }
      if (proposalId === undefined || proposalId === null) {
        throw new Error('Proposal ID is required');
      }

      try {
        const txHash = await writeContractAsync({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'vote',
          args: [BigInt(proposalId), support],
        });

        return txHash;
      } catch (error) {
        console.error('Voting failed:', error);
        throw error;
      }
    },
    [address, writeContractAsync],
  );

  const checkProposalExpiration = useCallback(
    async (proposalId: number) => {
      if (!address) {
        throw new Error('Wallet not connected');
      }
      if (proposalId === undefined || proposalId === null) {
        throw new Error('Proposal ID is required');
      }

      try {
        const txHash = await writeContractAsync({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'checkProposalExpiration',
          args: [BigInt(proposalId)],
        });

        return txHash;
      } catch (error) {
        console.error('Check proposal expiration failed:', error);
        throw error;
      }
    },
    [address, writeContractAsync],
  );

  const handleAccept = async () => {
    try {
      if (proposalId !== undefined && proposalId !== null) {
        await vote(proposalId, true);
      }
    } catch (error) {
      console.error('Failed to vote yes:', error);
    }
  };

  const handleReject = async () => {
    try {
      if (proposalId !== undefined && proposalId !== null) {
        await vote(proposalId, false);
      }
    } catch (error) {
      console.error('Failed to vote no:', error);
    }
  };

  const handleCheckProposalExpiration = async () => {
    try {
      if (proposalId !== undefined && proposalId !== null) {
        await checkProposalExpiration(proposalId);
      }
    } catch (error) {
      console.error('Failed to check proposal expiration:', error);
    }
  };

  return { handleAccept, handleReject, handleCheckProposalExpiration };
};
