/**
 * Privy's smart wallet client is often null briefly after load; mutations that
 * throw immediately fail before the user can complete wallet UI.
 */
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 100;

export async function waitForSmartWalletClient<T>(
  getClient: () => T | null | undefined,
  options?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const c = getClient();
    if (c != null) {
      return c;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(
    'Smart wallet is still initializing. Complete any wallet prompt in your browser, then try again.',
  );
}
