import 'server-only';

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';

import { getRelayerConfig } from '../config';

/**
 * RSUT lives at 0xaacf…2ac1 on Base and is a Hypha `DecayingSpaceToken` owned
 * by the RS Core Team executor. `mint` is gated on
 * `msg.sender == executor || isAuthorizedMinter[msg.sender]`, so this relayer
 * only works after the executor has run `batchSetAuthorizedMinters` for its
 * address once. Until then every mint fails with `!executor` and the grant
 * stays retryable — the ledger is unaffected.
 */
const rsutAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isAuthorizedMinter',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const RSUT_DECIMALS = 18;

export type MintOutcome =
  | { status: 'confirmed'; txHash: `0x${string}` }
  | { status: 'sent'; txHash: `0x${string}` }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

function resolveChain(chainId: number, rpcUrl: string) {
  if (chainId === base.id) return base;
  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

/**
 * Sends one mint. Never throws — the caller records the outcome against a
 * grant row that already exists, so a failure here is a retry, not a loss.
 */
export async function mintRsut(input: {
  to: string;
  rsut: number;
}): Promise<MintOutcome> {
  const config = getRelayerConfig();
  if (!config) {
    return { status: 'skipped', reason: 'Relayer not configured' };
  }
  if (!input.to) {
    return { status: 'skipped', reason: 'No wallet address on record' };
  }
  if (!(input.rsut > 0)) {
    return { status: 'skipped', reason: 'Nothing to mint' };
  }

  try {
    const account = privateKeyToAccount(config.privateKey, { nonceManager });
    const chain = resolveChain(config.chainId, config.rpcUrl);
    const transport = http(config.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });

    const amount = parseUnits(input.rsut.toFixed(RSUT_DECIMALS), RSUT_DECIMALS);

    // Simulating first turns an on-chain revert (most likely `!executor`, if
    // the relayer has not been authorised yet) into a clean error instead of a
    // burnt transaction.
    const { request } = await publicClient.simulateContract({
      account,
      address: config.tokenAddress,
      abi: rsutAbi,
      functionName: 'mint',
      args: [input.to as Address, amount],
    });

    const txHash = await walletClient.writeContract(request);

    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 20_000,
      });
      return receipt.status === 'success'
        ? { status: 'confirmed', txHash }
        : { status: 'failed', reason: `Reverted in ${txHash}` };
    } catch {
      // Broadcast but not yet mined. The retry sweep will confirm it later.
      return { status: 'sent', txHash };
    }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Unknown mint error';
    return { status: 'failed', reason: reason.slice(0, 500) };
  }
}

/** Diagnostics for the admin screen: is the relayer actually able to mint yet? */
export async function getRelayerStatus(): Promise<{
  configured: boolean;
  address: string | null;
  authorised: boolean | null;
  tokenAddress: string | null;
  error: string | null;
}> {
  const config = getRelayerConfig();
  if (!config) {
    return {
      configured: false,
      address: null,
      authorised: null,
      tokenAddress: null,
      error: null,
    };
  }

  const account = privateKeyToAccount(config.privateKey);
  const base_ = {
    configured: true,
    address: account.address,
    tokenAddress: config.tokenAddress,
  };

  try {
    const publicClient = createPublicClient({
      chain: resolveChain(config.chainId, config.rpcUrl),
      transport: http(config.rpcUrl),
    });
    const authorised = await publicClient.readContract({
      address: config.tokenAddress,
      abi: rsutAbi,
      functionName: 'isAuthorizedMinter',
      args: [account.address],
    });
    return { ...base_, authorised, error: null };
  } catch (error) {
    return {
      ...base_,
      authorised: null,
      error: error instanceof Error ? error.message : 'Unknown RPC error',
    };
  }
}
