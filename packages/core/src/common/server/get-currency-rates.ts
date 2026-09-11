import 'server-only';
import NodeCache from 'node-cache';
import { CURRENCY_FEEDS } from '../web3/token-backing-vault';
import {
  usdRateFromCoingeckoBtcQuotes,
  type UsdRates,
} from '../web3/currency-conversion';
import { parseFeedRate, type ChainlinkRound } from '../web3/chainlink-feed';
import { aggregatorV3InterfaceAbi } from '../../generated';
import { web3Client } from './web3-rpc/client';

const RATES_CACHE_KEY = 'chainlink_usd_rates';
const ratesCache = new NodeCache({ stdTTL: 300 });

/**
 * On-chain X/USD feeds only. Off-chain codes such as TZS must not be looked
 * up in {@link CURRENCY_FEEDS} — there is no AggregatorV3 for them.
 */
const CHAINLINK_QUOTED_CURRENCIES = (
  Object.keys(CURRENCY_FEEDS) as (keyof typeof CURRENCY_FEEDS)[]
).filter((currency) => currency !== 'USD');

const COINGECKO_TZS_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,tzs';

async function fetchOffchainUsdRates(): Promise<UsdRates> {
  try {
    const response = await fetch(COINGECKO_TZS_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.warn(`Off-chain TZS/USD fetch failed: ${response.status}`);
      return {};
    }
    const data = (await response.json()) as {
      bitcoin?: { usd?: number; tzs?: number };
    };
    const tzs = usdRateFromCoingeckoBtcQuotes(data.bitcoin ?? {});
    if (tzs === undefined) {
      console.warn('No off-chain TZS/USD rate from CoinGecko');
      return {};
    }
    return { TZS: tzs };
  } catch (error) {
    console.error('Failed to fetch off-chain TZS/USD rate:', error);
    return {};
  }
}

/**
 * USD value of one unit of each supported currency.
 *
 * On-chain codes are read from the Chainlink X/USD feeds on Base — the same
 * feeds the redemption contracts price against, so displayed balances cannot
 * drift from what a redemption actually pays out.
 *
 * TZS has no AggregatorV3 on Base. Its USD rate comes from CoinGecko
 * (same off-chain source as {@link getTokenPrice}), so portfolio totals are
 * not treated as 1:1 USD.
 *
 * Feeds / quotes that fail or report a non-positive answer are omitted rather
 * than guessed at; callers decide how to handle a missing rate.
 */
export async function getUsdRates(): Promise<UsdRates> {
  const cached = ratesCache.get<UsdRates>(RATES_CACHE_KEY);
  if (cached) return cached;

  const rates: UsdRates = { USD: 1 };

  const [offchain] = await Promise.all([
    fetchOffchainUsdRates(),
    (async () => {
      try {
        // Two reads per feed: the answer and the decimals it is scaled by.
        const results = await web3Client.multicall({
          allowFailure: true,
          contracts: CHAINLINK_QUOTED_CURRENCIES.flatMap((currency) => {
            const contract = {
              address: CURRENCY_FEEDS[currency],
              abi: aggregatorV3InterfaceAbi,
            } as const;
            return [
              { ...contract, functionName: 'latestRoundData' },
              { ...contract, functionName: 'decimals' },
            ];
          }),
        });

        CHAINLINK_QUOTED_CURRENCIES.forEach((currency, index) => {
          const roundResult = results[index * 2];
          const decimalsResult = results[index * 2 + 1];
          if (
            roundResult?.status !== 'success' ||
            decimalsResult?.status !== 'success'
          ) {
            console.warn(`No Chainlink answer for ${currency}/USD`);
            return;
          }

          // latestRoundData: [roundId, answer, startedAt, updatedAt, answeredInRound]
          const round = roundResult.result as readonly bigint[];
          const parsed = parseFeedRate(
            { answer: round[1], updatedAt: round[3] } satisfies ChainlinkRound,
            Number(decimalsResult.result),
          );
          if (!parsed.ok) {
            console.warn(
              `Skipping ${parsed.reason} Chainlink answer for ${currency}/USD`,
            );
            return;
          }

          rates[currency] = parsed.rate;
        });
      } catch (error) {
        console.error('Failed to fetch Chainlink currency rates:', error);
      }
    })(),
  ]);

  Object.assign(rates, offchain);

  ratesCache.set(RATES_CACHE_KEY, rates);
  return rates;
}
