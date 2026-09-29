import { describe, expect, it, vi } from 'vitest';

import {
  SMART_WALLET_CLIENT_UNAVAILABLE_MESSAGE,
  isSmartWalletClientUnavailableError,
  resolveSmartWalletClient,
} from '../resolve-smart-wallet-client';

const fakeClient = {
  writeContract: async () => '0xabc' as const,
};

describe('resolveSmartWalletClient', () => {
  it('returns the current client immediately', async () => {
    await expect(
      resolveSmartWalletClient({
        getClient: () => fakeClient,
        timeoutMs: 0,
      }),
    ).resolves.toBe(fakeClient);
  });

  it('uses getClientForChain when the hook client is still missing', async () => {
    const getClientForChain = vi.fn().mockResolvedValue(fakeClient);

    await expect(
      resolveSmartWalletClient({
        getClient: () => undefined,
        getClientForChain,
        timeoutMs: 0,
      }),
    ).resolves.toBe(fakeClient);
    expect(getClientForChain).toHaveBeenCalledWith({ id: 8453 });
  });

  it('waits for the hook client after getClientForChain fails', async () => {
    let client: typeof fakeClient | undefined;
    let now = 0;

    const resolved = resolveSmartWalletClient({
      getClient: () => client,
      getClientForChain: async () => {
        throw new Error('not ready');
      },
      timeoutMs: 500,
      pollMs: 100,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
        client = fakeClient;
      },
    });

    await expect(resolved).resolves.toBe(fakeClient);
  });

  it('throws the stable unavailable message after timeout', async () => {
    let now = 0;
    await expect(
      resolveSmartWalletClient({
        getClient: () => undefined,
        timeoutMs: 200,
        pollMs: 100,
        now: () => now,
        sleep: async (ms) => {
          now += ms;
        },
      }),
    ).rejects.toThrow(SMART_WALLET_CLIENT_UNAVAILABLE_MESSAGE);
  });

  it('detects the create-space console error string', () => {
    expect(
      isSmartWalletClientUnavailableError(
        new Error('Smart wallet client not available'),
      ),
    ).toBe(true);
  });
});
