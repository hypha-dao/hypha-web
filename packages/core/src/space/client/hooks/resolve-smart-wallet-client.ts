import { base } from 'viem/chains';

/** Keep this exact string — many forms remap it to i18n `smartWalletNotConnected`. */
export const SMART_WALLET_CLIENT_UNAVAILABLE_MESSAGE =
  'Smart wallet client not available';

export type SmartWalletWriteClient = {
  // Privy smart-wallet clients are viem-shaped; keep this loose so the helper
  // can wrap both `client` and `getClientForChain` without importing Privy types.
  writeContract: (...args: any[]) => Promise<`0x${string}`>;
};

export type ResolveSmartWalletClientInput = {
  getClient: () => SmartWalletWriteClient | null | undefined;
  getClientForChain?: (args: {
    id: number;
  }) => Promise<SmartWalletWriteClient | undefined>;
  chainId?: number;
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Privy `useSmartWallets().client` is only set after `user.smartWallet` is
 * linked. A valid JWT (enough for UploadThing) can exist while that client is
 * still initializing — or never appears if the session has no Coinbase smart
 * wallet. Wait briefly and try `getClientForChain` before failing.
 */
export async function resolveSmartWalletClient({
  getClient,
  getClientForChain,
  chainId = base.id,
  timeoutMs = 8_000,
  pollMs = 250,
  now = Date.now,
  sleep = defaultSleep,
}: ResolveSmartWalletClientInput): Promise<SmartWalletWriteClient> {
  const immediate = getClient();
  if (immediate) {
    return immediate;
  }

  if (getClientForChain) {
    try {
      const forChain = await getClientForChain({ id: chainId });
      if (forChain) {
        return forChain;
      }
    } catch {
      // Signer / smart-wallet config may still be initializing.
    }
  }

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await sleep(pollMs);
    const client = getClient();
    if (client) {
      return client;
    }
  }

  throw new Error(SMART_WALLET_CLIENT_UNAVAILABLE_MESSAGE);
}

export function isSmartWalletClientUnavailableError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : '';
  return message.includes(SMART_WALLET_CLIENT_UNAVAILABLE_MESSAGE);
}
