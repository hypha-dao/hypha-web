'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';

import { getTokenDecimals, publicClient } from '@hypha-platform/core/client';
import { getGovernanceChainId } from './governance-chain-id';
import { EXCHANGE_ESCROW_CONTRACT_BY_CHAIN } from './exchange-escrow-contract';
import { parseEscrowCreatedIdsFromLogs } from '../web3';

const READ_TIMEOUT_MS = 30_000;

async function withReadTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('RPC read timed out')), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

const escrowCreateAbi = [
  {
    type: 'function',
    name: 'createEscrow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_partyB', type: 'address', internalType: 'address' },
      { name: '_tokenA', type: 'address', internalType: 'address' },
      { name: '_tokenB', type: 'address', internalType: 'address' },
      { name: '_amountA', type: 'uint256', internalType: 'uint256' },
      { name: '_amountB', type: 'uint256', internalType: 'uint256' },
      { name: '_sendFundsNow', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
  },
] as const;

export type FundMemberExchangeEscrowInput = {
  sellerAddress: string;
  buyerAddress: string;
  sellerLeg: { amount: string; token: string }[];
  buyerLeg: { amount: string; token: string }[];
};

/**
 * After a member-seller exchange proposal is accepted, fund escrow from the seller wallet
 * (approve + createEscrow with sendFundsNow=true).
 */
export const useFundMemberExchangeEscrowWeb3Rpc = () => {
  const chainId = getGovernanceChainId();
  const { getClientForChain } = useSmartWallets();

  const {
    trigger: fundMemberExchangeEscrow,
    reset: resetFundMemberExchangeEscrow,
    isMutating: isFundingMemberExchangeEscrow,
    error: errorFundMemberExchangeEscrow,
    data: fundedEscrowIds,
  } = useSWRMutation(
    'fund-member-exchange-escrow',
    async (
      _: string,
      { arg }: { arg: FundMemberExchangeEscrowInput },
    ): Promise<bigint[]> => {
      const client = await getClientForChain({ id: chainId });
      if (!client) {
        throw new Error(
          `Smart wallet client not available for chain ${chainId}. Switch network and try again.`,
        );
      }

      const smartWalletAddress = (
        client as { account?: { address?: `0x${string}` } } | null
      )?.account?.address;
      if (
        smartWalletAddress &&
        arg.sellerAddress.toLowerCase() !== smartWalletAddress.toLowerCase()
      ) {
        throw new Error('EXCHANGE_MEMBER_SELLER_WALLET_MISMATCH');
      }

      const escrowAddress = EXCHANGE_ESCROW_CONTRACT_BY_CHAIN[chainId];
      if (!escrowAddress) {
        throw new Error(`Escrow contract not configured for chain ${chainId}`);
      }

      const sellerRows = arg.sellerLeg ?? [];
      const buyerRows = arg.buyerLeg ?? [];
      if (
        sellerRows.length === 0 ||
        buyerRows.length === 0 ||
        sellerRows.length !== buyerRows.length
      ) {
        throw new Error('Invalid seller/buyer legs');
      }

      const escrowIds: bigint[] = [];

      for (let index = 0; index < sellerRows.length; index++) {
        const sellerRow = sellerRows[index];
        const buyerRow = buyerRows[index];
        if (!sellerRow || !buyerRow) continue;

        const sellerTokenDecimals = await withReadTimeout(
          getTokenDecimals(sellerRow.token),
          READ_TIMEOUT_MS,
        );
        const buyerTokenDecimals = await withReadTimeout(
          getTokenDecimals(buyerRow.token),
          READ_TIMEOUT_MS,
        );
        const sellerAmount = parseUnits(sellerRow.amount, sellerTokenDecimals);
        const buyerAmount = parseUnits(buyerRow.amount, buyerTokenDecimals);
        const sellerToken = sellerRow.token as `0x${string}`;

        let hash = await client.writeContract({
          address: sellerToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, BigInt(0)],
        });
        await publicClient.waitForTransactionReceipt({ hash });

        hash = await client.writeContract({
          address: sellerToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, sellerAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash });

        hash = await client.writeContract({
          address: escrowAddress,
          abi: escrowCreateAbi,
          functionName: 'createEscrow',
          args: [
            arg.buyerAddress as `0x${string}`,
            sellerToken,
            buyerRow.token as `0x${string}`,
            sellerAmount,
            buyerAmount,
            true,
          ],
        });
        const escrowReceipt = await publicClient.waitForTransactionReceipt({
          hash,
        });
        escrowIds.push(...parseEscrowCreatedIdsFromLogs(escrowReceipt.logs));
      }

      return escrowIds;
    },
  );

  return {
    fundMemberExchangeEscrow,
    resetFundMemberExchangeEscrow,
    isFundingMemberExchangeEscrow,
    errorFundMemberExchangeEscrow,
    fundedEscrowIds,
  };
};
