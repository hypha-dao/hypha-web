import 'server-only';
import NodeCache from 'node-cache';
import { CURRENCY_FEEDS } from '../web3/token-backing-vault';
import {
  applyLastKnownOffchainRates,
  usdRateFromUnitsPerUsd,
  type UsdRates,
} from '../web3/currency-conversion';
import { parseFeedRate, type ChainlinkRound } from '../web3/chainlink-feed';
import { aggregatorV3InterfaceAbi } from '../../generated';
import { web3Client } from './web3-rpc/client';
import { getOpenErApiUsdLatest } from './open-er-api-client';

const RATES_CACHE_KEY = 'chainlink_usd_rates';
const LAST_OFFCHAIN_RATES_KEY = 'last_offchain_usd_rates';
const ratesCache = new NodeCache({ stdTTL: 300 });
/** Keep a validated TZS quote through short FX outages (24h). */
const lastOffchainRatesCache = new NodeCache({ stdTTL: 24 * 60 * 60 });

/**
 * On-chain X/USD feeds only. Off-chain codes such as TZS must not be looked
 * up in {@link CURRENCY_FEEDS} — there is no AggregatorV3 for them.
 */
const CHAINLINK_QUOTED_CURRENCIES = (
  Object.keys(CURRENCY_FEEDS) as (keyof typeof CURRENCY_FEEDS)[]
).filter((currency) => currency !== 'USD');

async function fetchOffchainUsdRates(): Promise<UsdRates> {
  try {
    const data = await getOpenErApiUsdLatest();
    const tzs = usdRateFromUnitsPerUsd(data.rates?.TZS);
    if (tzs === undefined) {
      console.warn('No off-chain TZS/USD rate from open.er-api.com');
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
 * TZS has no AggregatorV3 on Base. Its USD rate comes from open.er-api.com
 * (`rates.TZS` is TZS per 1 USD; we store the inverse). A failed live quote
 * reuses the last validated TZS rate when one exists. That fallback is applied
 * at read time and is not written into the 5-minute rates cache, so it cannot
 * outlive the 24-hour last-known TTL.
 *
 * Feeds / quotes that fail or report a non-positive answer are omitted rather
 * than guessed at; callers decide how to handle a missing rate.
 */
function withLastKnownOffchainRates(rates: UsdRates): UsdRates {
  const lastKnown =
    lastOffchainRatesCache.get<UsdRates>(LAST_OFFCHAIN_RATES_KEY) ?? {};
  return applyLastKnownOffchainRates(rates, lastKnown);
}

export async function getUsdRates(): Promise<UsdRates> {
  const cached = ratesCache.get<UsdRates>(RATES_CACHE_KEY);
  if (cached) return withLastKnownOffchainRates(cached);

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
  if (offchain.TZS !== undefined && offchain.TZS > 0) {
    lastOffchainRatesCache.set(LAST_OFFCHAIN_RATES_KEY, {
      TZS: offchain.TZS,
    });
  }
  // Persist live quotes only — a last-known TZS overlay is applied on read.
  ratesCache.set(RATES_CACHE_KEY, rates);
  return withLastKnownOffchainRates(rates);
}
