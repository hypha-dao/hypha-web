export function formMap<T extends { spaceId: bigint }>(
  input: Array<T>,
): Map<bigint, T> {
  return new Map(input.map((element) => [element.spaceId, element]));
}

type ReadWithWarmupRetryProps<T> = {
  label: string;
  spaceIds: bigint[];
  read: () => Promise<T[]>;
  maxAttempts?: number;
  retryDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mitigate first-hit/cold-start RPC jitter:
 * - retries once on thrown errors
 * - retries once when all requested reads came back empty
 */
export async function readWithWarmupRetry<T>({
  label,
  spaceIds,
  read,
  maxAttempts = 2,
  retryDelayMs = 300,
}: ReadWithWarmupRetryProps<T>): Promise<T[]> {
  if (spaceIds.length === 0) return [];

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await read();
      const shouldRetryForEmpty = result.length === 0 && attempt < maxAttempts;

      if (!shouldRetryForEmpty) {
        return result;
      }

      console.warn(`[${label}] Empty RPC enrichment result, retrying`, {
        attempt,
        maxAttempts,
        web3SpaceCount: spaceIds.length,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        throw error;
      }
      console.warn(`[${label}] RPC read failed, retrying`, {
        attempt,
        maxAttempts,
        web3SpaceCount: spaceIds.length,
        error,
      });
    }

    await sleep(retryDelayMs * attempt);
  }

  throw (
    lastError ??
    new Error(
      `[${label}] RPC read failed after retries without explicit error object`,
    )
  );
}
