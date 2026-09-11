import 'server-only';

const COINGECKO_SIMPLE_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price';

/** Bound so a hung CoinGecko response cannot stall currency-rates / assets. */
const FETCH_TIMEOUT_MS = 15_000;

export type CoingeckoBitcoinUsdTzsQuotes = {
  bitcoin?: { usd?: number; tzs?: number };
};

function coingeckoHeaders(): HeadersInit {
  return { Accept: 'application/json' };
}

/**
 * BTC quoted in USD and TZS. Callers derive USD-per-TZS from the pair.
 * Throws on non-2xx so consumers decide the fallback.
 */
export async function getCoingeckoBitcoinUsdTzsQuotes(): Promise<CoingeckoBitcoinUsdTzsQuotes> {
  const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=bitcoin&vs_currencies=usd,tzs`;
  const response = await fetch(url, {
    headers: coingeckoHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`CoinGecko simple/price failed: ${response.status}`);
  }
  return (await response.json()) as CoingeckoBitcoinUsdTzsQuotes;
}
