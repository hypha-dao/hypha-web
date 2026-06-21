import 'server-only';

import NodeCache from 'node-cache';
import type { SupportedDisplayCurrency } from '../currency';
import type { CurrencyRatesToUsd } from '../currency-rates';
import { CURRENCY_FEEDS } from '../web3/token-backing-vault';
import { web3Client } from './web3-rpc/client';

const chainlinkPriceFeedAbi = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const;

const ratesCache = new NodeCache({ stdTTL: 300 });

const NON_USD_CURRENCIES = Object.entries(CURRENCY_FEEDS).filter(
  ([code]) => code !== 'USD',
) as Array<[SupportedDisplayCurrency, `0x${string}`]>;

async function readCurrencyToUsdRate(
  feedAddress: `0x${string}`,
): Promise<number> {
  const [decimals, latestRoundData] = await web3Client.multicall({
    contracts: [
      {
        address: feedAddress,
        abi: chainlinkPriceFeedAbi,
        functionName: 'decimals',
      },
      {
        address: feedAddress,
        abi: chainlinkPriceFeedAbi,
        functionName: 'latestRoundData',
      },
    ],
  });

  if (decimals.status !== 'success' || latestRoundData.status !== 'success') {
    return 1;
  }

  const answer = latestRoundData.result[1];
  if (answer <= 0n) {
    return 1;
  }

  return Number(answer) / 10 ** Number(decimals.result);
}

export async function getCurrencyRatesToUsd(): Promise<CurrencyRatesToUsd> {
  const cached = ratesCache.get<CurrencyRatesToUsd>('currency-rates-to-usd');
  if (cached) {
    return cached;
  }

  const rates: CurrencyRatesToUsd = {
    USD: 1,
    EUR: 1,
    GBP: 1,
    CAD: 1,
    CHF: 1,
    AUD: 1,
  };

  await Promise.all(
    NON_USD_CURRENCIES.map(async ([code, feedAddress]) => {
      try {
        rates[code] = await readCurrencyToUsdRate(feedAddress);
      } catch (error) {
        console.warn(`Failed to fetch ${code}/USD rate:`, error);
        rates[code] = 1;
      }
    }),
  );

  ratesCache.set('currency-rates-to-usd', rates);
  return rates;
}
