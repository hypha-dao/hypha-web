import 'server-only';

import { createPublicClient, createWalletClient, http } from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

/**
 * Background mirror of signal upvotes to the Signals contract
 * (packages/storage-evm/contracts/SignalsImplementation.sol). The off-chain
 * Postgres record is the source of truth; this only emits an auditable
 * on-chain event and must never affect the user-facing flow — errors are
 * logged and swallowed, and the feature is off unless both env vars are set:
 *
 *   SIGNALS_CONTRACT_ADDRESS      — deployed Signals proxy address
 *   SIGNALS_RELAYER_PRIVATE_KEY   — relayer wallet authorized via setRelayer
 */
const signalsAbi = [
  {
    type: 'function',
    name: 'recordUpvote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_spaceId', type: 'uint256' },
      { name: '_signalId', type: 'uint256' },
      { name: '_voter', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'recordUpvoteRemoval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_spaceId', type: 'uint256' },
      { name: '_signalId', type: 'uint256' },
      { name: '_voter', type: 'address' },
    ],
    outputs: [],
  },
] as const;

type UpvoteEvent = {
  web3SpaceId: number;
  signalId: number;
  voter: `0x${string}`;
  /** Wei-scale voting power; required for upvotes, ignored for removals. */
  amount?: bigint;
  kind: 'upvote' | 'removal';
};

function getSignalsConfig() {
  const address = process.env.SIGNALS_CONTRACT_ADDRESS?.trim();
  // Tolerate keys pasted without the 0x prefix or with stray quotes/spaces.
  const rawKey = process.env.SIGNALS_RELAYER_PRIVATE_KEY?.trim().replace(
    /^['"]|['"]$/g,
    '',
  );
  if (!address || !rawKey) return null;

  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error(
      '[signals-onchain] SIGNALS_RELAYER_PRIVATE_KEY is not a 32-byte hex key; skipping on-chain mirror',
    );
    return null;
  }

  return {
    address: address as `0x${string}`,
    privateKey: privateKey as `0x${string}`,
  };
}

export async function recordSignalUpvoteOnChain(
  event: UpvoteEvent,
): Promise<void> {
  const config = getSignalsConfig();
  if (!config) {
    console.debug(
      '[signals-onchain] SIGNALS_CONTRACT_ADDRESS / SIGNALS_RELAYER_PRIVATE_KEY not set; skipping on-chain mirror',
    );
    return;
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

    let hash: `0x${string}`;
    if (event.kind === 'upvote') {
      const { request } = await publicClient.simulateContract({
        account,
        address: config.address,
        abi: signalsAbi,
        functionName: 'recordUpvote',
        args: [
          BigInt(event.web3SpaceId),
          BigInt(event.signalId),
          event.voter,
          event.amount ?? 0n,
        ],
      });
      hash = await walletClient.writeContract(request);
    } else {
      const { request } = await publicClient.simulateContract({
        account,
        address: config.address,
        abi: signalsAbi,
        functionName: 'recordUpvoteRemoval',
        args: [BigInt(event.web3SpaceId), BigInt(event.signalId), event.voter],
      });
      hash = await walletClient.writeContract(request);
    }
    console.log(
      `[signals-onchain] mirrored ${event.kind} for signal ${event.signalId} in space ${event.web3SpaceId}: ${hash}`,
    );
  } catch (error) {
    // Best-effort mirror: the vote is already stored off-chain.
    console.error(
      `[signals-onchain] failed to mirror ${event.kind} for signal ${event.signalId}:`,
      error,
    );
  }
}
