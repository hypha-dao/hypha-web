'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';

import { getTokenDecimals, publicClient } from '@hypha-platform/core/client';
import { getGovernanceChainId } from './governance-chain-id';
import {
  EXCHANGE_ESCROW_CONTRACT_BY_CHAIN,
  isExchangeEscrowContractAddress,
} from './exchange-escrow-contract';
import { canExecutorSendToEscrowForExchange } from './exchange-token-whitelist-eligibility';
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

/** OpenZeppelin SafeERC20 — raised when token transferFrom fails inside escrow. */
const safeErc20FailedOperationError = {
  type: 'error',
  name: 'SafeERC20FailedOperation',
  inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
} as const;

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
  safeErc20FailedOperationError,
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
  /** Same as contribution proposals: use default smart wallet client (no getClientForChain). */
  const { client } = useSmartWallets();

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
      if (!client) {
        throw new Error('Smart wallet client not available');
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

      const fromAccount = (smartWalletAddress ??
        (client as { account?: { address?: `0x${string}` } }).account
          ?.address) as `0x${string}` | undefined;
      if (!fromAccount) {
        throw new Error('Smart wallet address not available');
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

      for (const row of [...sellerRows, ...buyerRows]) {
        if (
          isExchangeEscrowContractAddress(row.token) ||
          row.token.toLowerCase() === escrowAddress.toLowerCase()
        ) {
          throw new Error(
            'EXCHANGE_ESCROW_TOKEN_INVALID: A token row points to the escrow contract. Use the ERC-20 token contract address, not the escrow.',
          );
        }
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

        const balanceWei = await withReadTimeout(
          publicClient.readContract({
            address: sellerToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [fromAccount],
          }),
          READ_TIMEOUT_MS,
        );
        if (balanceWei < sellerAmount) {
          throw new Error(
            'EXCHANGE_INSUFFICIENT_SELLER_BALANCE: The connected wallet does not hold enough of the seller token. Tokens must be on the smart wallet that signs this transaction.',
          );
        }

        const sellerOk = await canExecutorSendToEscrowForExchange({
          tokenAddress: sellerToken,
          executorAddress: fromAccount,
          escrowAddress,
        });
        if (!sellerOk) {
          throw new Error(
            'EXCHANGE_TOKEN_WHITELIST_BLOCKED: This space token blocks the seller transfer to escrow (whitelist). Pick a token that allows your wallet to send and the escrow to receive.',
          );
        }

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

        await publicClient.simulateContract({
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
          account: fromAccount,
        });

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
