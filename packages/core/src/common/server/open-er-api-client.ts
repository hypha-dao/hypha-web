import 'server-only';

const OPEN_ER_API_USD_URL = 'https://open.er-api.com/v6/latest/USD';

/** Bound so a hung FX response cannot stall currency-rates / assets. */
const FETCH_TIMEOUT_MS = 15_000;

export type OpenErApiUsdLatestResponse = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
};

/**
 * USD-base fiat table from open.er-api.com (no API key).
 * `rates.TZS` is TZS per 1 USD. Throws on non-2xx so consumers decide the fallback.
 */
export async function getOpenErApiUsdLatest(): Promise<OpenErApiUsdLatestResponse> {
  const response = await fetch(OPEN_ER_API_USD_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`open.er-api.com latest/USD failed: ${response.status}`);
  }
  const data = (await response.json()) as OpenErApiUsdLatestResponse;
  if (data.result !== 'success') {
    throw new Error(
      `open.er-api.com latest/USD returned ${String(data.result)}`,
    );
  }
  return data;
}
