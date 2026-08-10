import 'server-only';
import NodeCache from 'node-cache';
import { CURRENCY_FEEDS } from '../web3/token-backing-vault';
import {
  CONVERTIBLE_CURRENCIES,
  type UsdRates,
} from '../web3/currency-conversion';
import { aggregatorV3InterfaceAbi } from '../../generated';
import { web3Client } from './web3-rpc/client';

const RATES_CACHE_KEY = 'chainlink_usd_rates';
const ratesCache = new NodeCache({ stdTTL: 300 });

/** Feeds other than USD — USD is the quote currency, so its rate is always 1. */
const QUOTED_CURRENCIES = CONVERTIBLE_CURRENCIES.filter(
  (currency) => currency !== 'USD',
);

/**
 * USD value of one unit of each supported currency, read from the Chainlink
 * X/USD feeds on Base — the same feeds the redemption contracts price against,
 * so displayed balances cannot drift from what a redemption actually pays out.
 *
 * Feeds that fail or report a non-positive answer are omitted rather than
 * guessed at; callers decide how to handle a missing rate.
 */
export async function getUsdRates(): Promise<UsdRates> {
  const cached = ratesCache.get<UsdRates>(RATES_CACHE_KEY);
  if (cached) return cached;

  const rates: UsdRates = { USD: 1 };

  try {
    // Two reads per feed: the answer and the decimals it is scaled by.
    const results = await web3Client.multicall({
      allowFailure: true,
      contracts: QUOTED_CURRENCIES.flatMap((currency) => {
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

    QUOTED_CURRENCIES.forEach((currency, index) => {
      const roundResult = results[index * 2];
      const decimalsResult = results[index * 2 + 1];
      if (
        roundResult?.status !== 'success' ||
        decimalsResult?.status !== 'success'
      ) {
        console.warn(`No Chainlink answer for ${currency}/USD`);
        return;
      }

      const answer = (roundResult.result as readonly bigint[])[1];
      const decimals = Number(decimalsResult.result);
      if (answer == null || answer <= 0n || !Number.isFinite(decimals)) {
        console.warn(`Invalid Chainlink answer for ${currency}/USD`);
        return;
      }

      rates[currency] = Number(answer) / 10 ** decimals;
    });
  } catch (error) {
    console.error('Failed to fetch Chainlink currency rates:', error);
  }

  ratesCache.set(RATES_CACHE_KEY, rates);
  return rates;
}
