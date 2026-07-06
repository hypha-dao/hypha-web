import 'server-only';

import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  maxUint256,
} from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

import { hyphaTokenAbi, hyphaTokenAddress } from '../../generated';
import { BASE_CHAIN_ID, SUBSCRIPTION_USDC_ADDRESS } from '../constants';

export type SettleSpaceSubscriptionInput = {
  web3SpaceId: number;
  /** 6-decimal USDC base units to pay through HyphaToken.payForSpaces. */
  amountUsdc: bigint;
};

export type SettleSpaceSubscriptionResult =
  | { ok: true; txHash: `0x${string}` }
  | { ok: false; error: string };

export type SettleSpaceSubscriptionFn = (
  input: SettleSpaceSubscriptionInput,
) => Promise<SettleSpaceSubscriptionResult>;

function getPayerConfig(): { privateKey: `0x${string}` } | null {
  // Tolerate keys pasted without the 0x prefix or with stray quotes/spaces.
  const rawKey = process.env.SUBSCRIPTION_PAYER_PRIVATE_KEY?.trim().replace(
    /^['"]|['"]$/g,
    '',
  );
  if (!rawKey) return null;

  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error(
      '[space-subscription] SUBSCRIPTION_PAYER_PRIVATE_KEY is not a 32-byte hex key',
    );
    return null;
  }

  return { privateKey: privateKey as `0x${string}` };
}

/**
 * Converts a paid Stripe invoice into on-chain subscription days: the
 * platform hot wallet pays USDC through HyphaToken.payForSpaces, which
 * extends the space's expiry in SpacePaymentTracker.
 *
 * Never throws — failures (missing key, empty USDC float, RPC errors) are
 * returned so the caller can mark the invoice `failed` and retry later.
 */
export async function settleSpaceSubscriptionOnchain(
  input: SettleSpaceSubscriptionInput,
): Promise<SettleSpaceSubscriptionResult> {
  const config = getPayerConfig();
  if (!config) {
    return {
      ok: false,
      error: 'SUBSCRIPTION_PAYER_PRIVATE_KEY is not configured',
    };
  }

  try {
    const account = privateKeyToAccount(config.privateKey, { nonceManager });
    const transport = http(process.env.RPC_URL || 'https://mainnet.base.org');
    const publicClient = createPublicClient({ chain: base, transport });
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport,
    });

    const hyphaToken = hyphaTokenAddress[BASE_CHAIN_ID];

    const [balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: SUBSCRIPTION_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      }),
      publicClient.readContract({
        address: SUBSCRIPTION_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, hyphaToken],
      }),
    ]);

    if (balance < input.amountUsdc) {
      return {
        ok: false,
        error: `Payer wallet ${account.address} holds ${balance} USDC base units, needs ${input.amountUsdc}`,
      };
    }

    if (allowance < input.amountUsdc) {
      const { request } = await publicClient.simulateContract({
        account,
        address: SUBSCRIPTION_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [hyphaToken, maxUint256],
      });
      const approveHash = await walletClient.writeContract(request);
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveHash,
      });
      if (approveReceipt.status !== 'success') {
        return { ok: false, error: `USDC approve reverted: ${approveHash}` };
      }
    }

    const { request } = await publicClient.simulateContract({
      account,
      address: hyphaToken,
      abi: hyphaTokenAbi,
      functionName: 'payForSpaces',
      args: [[BigInt(input.web3SpaceId)], [input.amountUsdc]],
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== 'success') {
      return { ok: false, error: `payForSpaces reverted: ${txHash}` };
    }

    console.log(
      `[space-subscription] settled space ${input.web3SpaceId} for ${input.amountUsdc} USDC base units: ${txHash}`,
    );
    return { ok: true, txHash };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown settlement error';
    console.error(
      `[space-subscription] settlement failed for space ${input.web3SpaceId}:`,
      error,
    );
    return { ok: false, error: message };
  }
}
