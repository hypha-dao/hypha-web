'use client';

import { useCallback, useState } from 'react';
import { encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';
import { createGovernancePublicClient } from '../../../common/web3/governance-public-client';
import { getGovernanceChainId } from './governance-chain-id';

export const useProposalVoting = ({
  proposalId,
}: {
  proposalId?: number | null;
}) => {
  const chainId = getGovernanceChainId();
  const { address } = useAccount();
  const { client, getClientForChain } = useSmartWallets();
  const [isVoting, setIsVoting] = useState(false);
  const [isCheckingExpiration, setIsCheckingExpiration] = useState(false);

  const vote = useCallback(
    async (support: boolean) => {
      if (proposalId == null) throw new Error('Proposal ID is required');

      setIsVoting(true);
      try {
        // The default smart-wallet client follows whichever chain was last
        // active. A vote has to be signed on the governance chain, and
        // `sendTransaction` is the method that opens the wallet signature.
        // `writeContract` closes over the raw client and skips that prompt.
        const votingClient =
          (await getClientForChain({ id: chainId })) ?? client;
        if (!votingClient) throw new Error('Smart wallet not connected');

        const governancePublicClient = createGovernancePublicClient();
        const hash = await votingClient.sendTransaction({
          to: daoProposalsImplementationConfig.address[chainId],
          data: encodeFunctionData({
            abi: daoProposalsImplementationConfig.abi,
            functionName: 'vote',
            args: [BigInt(proposalId), support],
          }),
        });
        await governancePublicClient.waitForTransactionReceipt({ hash });
        return hash;
      } finally {
        setIsVoting(false);
      }
    },
    [chainId, client, getClientForChain, proposalId],
  );

  const checkProposalExpiration = useCallback(async () => {
    if (!client) throw new Error('Smart wallet not connected');
    if (!address) throw new Error('Wallet not connected');
    if (proposalId == null) throw new Error('Proposal ID is required');

    setIsCheckingExpiration(true);
    try {
      const governancePublicClient = createGovernancePublicClient();
      const hash = await client.writeContract({
        address: daoProposalsImplementationConfig.address[chainId],
        abi: daoProposalsImplementationConfig.abi,
        functionName: 'triggerExecutionCheck',
        args: [BigInt(proposalId)],
      });
      await governancePublicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      console.error('Error checking proposal expiration:', err);
      throw err;
    } finally {
      setIsCheckingExpiration(false);
    }
  }, [address, chainId, client, proposalId]);

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
