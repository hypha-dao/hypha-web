'use client';

import { useCallback, useState } from 'react';
import type { Hash } from 'viem';
import { useAccount } from 'wagmi';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';
import { createGovernancePublicClient } from '../../../common/web3/governance-public-client';
import { getGovernanceChainId } from './governance-chain-id';
import {
  signVoteWithExplicitConsent,
  signVoteWithWalletPrompt,
} from './vote-signing';
import type { UserExplicitConsent } from './user-explicit-consent';

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

  // The default smart-wallet client follows whichever chain was last active.
  // A vote has to be signed on the governance chain.
  const resolveVoteInput = useCallback(
    async (support: boolean) => {
      if (proposalId == null) throw new Error('Proposal ID is required');
      const votingClient = (await getClientForChain({ id: chainId })) ?? client;
      if (!votingClient) throw new Error('Smart wallet not connected');
      return {
        signer: votingClient,
        contractAddress: daoProposalsImplementationConfig.address[chainId],
        proposalId,
        support,
      };
    },
    [chainId, client, getClientForChain, proposalId],
  );

  const runVote = useCallback(
    async (
      sign: (
        input: Awaited<ReturnType<typeof resolveVoteInput>>,
      ) => Promise<Hash>,
      support: boolean,
    ) => {
      setIsVoting(true);
      try {
        const input = await resolveVoteInput(support);
        const governancePublicClient = createGovernancePublicClient();
        const hash = await sign(input);
        await governancePublicClient.waitForTransactionReceipt({ hash });
        return hash;
      } finally {
        setIsVoting(false);
      }
    },
    [resolveVoteInput],
  );

  // Wallet provider confirmation shown (`sendTransaction` opens it).
  const vote = useCallback(
    (support: boolean) => runVote(signVoteWithWalletPrompt, support),
    [runVote],
  );

  /**
   * Signs without the wallet provider's confirmation. Only for a screen that
   * just asked the user to confirm this exact vote; see `vote-signing.ts`.
   * Regular callers must keep `handleAccept` / `handleReject`.
   */
  const voteWithExplicitConsent = useCallback(
    (support: boolean, consent: UserExplicitConsent) =>
      runVote((input) => signVoteWithExplicitConsent(input, consent), support),
    [runVote],
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
    voteWithExplicitConsent,
    handleCheckProposalExpiration,
    isVoting,
    isCheckingExpiration,
  };
};
