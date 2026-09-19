import 'server-only';

import { sql } from 'drizzle-orm';
import { erc20Abi } from 'viem';
import { spaces } from '@hypha-platform/storage-postgres';
import { aggregatorV3InterfaceAbi } from '../../generated';
import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../common/server/types';
import { parseFeedRate } from '../../common/web3/chainlink-feed';
import { ASSET_PRICE_FEED_BY_TOKEN } from '../../common/web3/token-backing-vault';
import {
  HYPHA_PRICE_USD,
  TOKENS,
  isHyphaToken,
} from '../../common/web3/tokens';
import {
  tokenRawToUsd,
  type NetworkTreasurySnapshot,
} from '../network-dashboard';

const TREASURY_CACHE_TTL_MS = 15 * 60 * 1000;
const BALANCE_BATCH_SIZE = 80;
const FALLBACK_DECIMALS: Record<string, number> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6, // USDC
  '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42': 6, // EURC
  '0x449b3317a6d1efb1bc3ba0700c9eaa4ffff4ae65': 6, // AUDD
  '0x4200000000000000000000000000000000000006': 18, // WETH
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8, // cbBTC
  '0x8b93862835c36e9689e9bb1ab21de3982e266cd3': 18, // HYPHA
};

let treasuryCache: {
  expiresAt: number;
  data: NetworkTreasurySnapshot;
} | null = null;
let treasuryInFlight: Promise<NetworkTreasurySnapshot> | null = null;

function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function listPublicTreasuryAddresses({
  db,
}: DbConfig): Promise<`0x${string}`[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT lower(${spaces.address}) AS address
    FROM ${spaces}
    WHERE ${spaces.isArchived} = false
      AND ${spaces.address} IS NOT NULL
      AND NOT (${spaces.flags} @> '["sandbox"]'::jsonb)
      AND NOT (${spaces.flags} @> '["archived"]'::jsonb)
      AND ${spaces.title} NOT ILIKE ${'%test%'}
      AND ${spaces.slug} NOT ILIKE ${'%test%'}
      AND btrim(
        regexp_replace(
          regexp_replace(
            ${spaces.title},
            E'[\\u200B-\\u200D\\uFEFF]',
            '',
            'g'
          ),
          E'[\\s\\u00A0\\u202F\\u2007\\u2060]+',
          ' ',
          'g'
        )
      ) <> ''
      AND btrim(
        regexp_replace(
          regexp_replace(
            ${spaces.title},
            E'[\\u200B-\\u200D\\uFEFF]',
            '',
            'g'
          ),
          E'[\\s\\u00A0\\u202F\\u2007\\u2060]+',
          ' ',
          'g'
        )
      ) !~* '^space [0-9]+$'
  `);

  const rows = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && 'rows' in result
    ? (result as { rows: unknown }).rows
    : [];
  if (!Array.isArray(rows)) return [];

  const unique = new Set<`0x${string}`>();
  for (const row of rows) {
    const address =
      row && typeof row === 'object' && 'address' in row
        ? String((row as { address: unknown }).address ?? '')
        : '';
    if (isEvmAddress(address)) unique.add(address);
  }
  return [...unique];
}

async function readCatalogueDecimals(): Promise<Map<string, number>> {
  const decimals = new Map<string, number>();
  const results = await web3Client.multicall({
    allowFailure: true,
    contracts: TOKENS.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'decimals' as const,
    })),
  });

  TOKENS.forEach((token, index) => {
    const key = token.address.toLowerCase();
    const result = results[index];
    if (result?.status === 'success' && typeof result.result === 'number') {
      decimals.set(key, result.result);
      return;
    }
    decimals.set(key, FALLBACK_DECIMALS[key] ?? 18);
  });
  return decimals;
}

async function readCatalogueUsdPrices(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const priced = TOKENS.filter(
    (token) => !isHyphaToken(token.address) && token.symbol !== 'USDC',
  );
  const results = await web3Client.multicall({
    allowFailure: true,
    contracts: priced.flatMap((token) => {
      const feed = ASSET_PRICE_FEED_BY_TOKEN[token.address.toLowerCase()];
      if (!feed) return [];
      const contract = {
        address: feed,
        abi: aggregatorV3InterfaceAbi,
      } as const;
      return [
        { ...contract, functionName: 'latestRoundData' as const },
        { ...contract, functionName: 'decimals' as const },
      ];
    }),
  });

  let cursor = 0;
  for (const token of priced) {
    const feed = ASSET_PRICE_FEED_BY_TOKEN[token.address.toLowerCase()];
    if (!feed) continue;
    const roundResult = results[cursor];
    const decimalsResult = results[cursor + 1];
    cursor += 2;
    if (
      roundResult?.status !== 'success' ||
      decimalsResult?.status !== 'success'
    ) {
      continue;
    }
    const round = roundResult.result as readonly bigint[];
    const parsed = parseFeedRate(
      { answer: round[1], updatedAt: round[3] },
      Number(decimalsResult.result),
    );
    if (parsed.ok) {
      prices.set(token.address.toLowerCase(), parsed.rate);
    }
  }

  prices.set('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 1);
  prices.set('0x8b93862835c36e9689e9bb1ab21de3982e266cd3', HYPHA_PRICE_USD);
  return prices;
}

async function sumTokenBalancesUsd(
  addresses: readonly `0x${string}`[],
  tokenAddress: `0x${string}`,
  decimals: number,
  usdPerUnit: number,
): Promise<number> {
  if (addresses.length === 0 || !(usdPerUnit > 0)) return 0;
  let total = 0;
  for (let index = 0; index < addresses.length; index += BALANCE_BATCH_SIZE) {
    const batch = addresses.slice(index, index + BALANCE_BATCH_SIZE);
    const results = await web3Client.multicall({
      allowFailure: true,
      contracts: batch.map((address) => ({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [address] as const,
      })),
    });
    results.forEach((result) => {
      if (result.status !== 'success') return;
      total += tokenRawToUsd(result.result, decimals, usdPerUnit);
    });
  }
  return total;
}

async function computeNetworkTreasuryStats({
  db,
}: DbConfig): Promise<NetworkTreasurySnapshot> {
  const [addresses, decimalsByToken, pricesByToken] = await Promise.all([
    listPublicTreasuryAddresses({ db }),
    readCatalogueDecimals(),
    readCatalogueUsdPrices(),
  ]);

  const tokens = [];
  for (const token of TOKENS) {
    const key = token.address.toLowerCase();
    const usdPerUnit = pricesByToken.get(key) ?? 0;
    const decimals = decimalsByToken.get(key) ?? FALLBACK_DECIMALS[key] ?? 18;
    const usd = await sumTokenBalancesUsd(
      addresses,
      token.address,
      decimals,
      usdPerUnit,
    );
    tokens.push({
      symbol: token.symbol,
      address: token.address,
      usd,
    });
  }

  return {
    aumUsd: tokens.reduce((sum, token) => sum + token.usd, 0),
    treasuryCount: addresses.length,
    tokens,
    generatedAt: new Date().toISOString(),
  };
}

export async function findNetworkTreasuryStats({
  db,
}: DbConfig): Promise<NetworkTreasurySnapshot> {
  if (treasuryCache && treasuryCache.expiresAt > Date.now()) {
    return treasuryCache.data;
  }
  if (!treasuryInFlight) {
    treasuryInFlight = computeNetworkTreasuryStats({ db })
      .then((data) => {
        treasuryCache = {
          data,
          expiresAt: Date.now() + TREASURY_CACHE_TTL_MS,
        };
        return data;
      })
      .finally(() => {
        treasuryInFlight = null;
      });
  }
  return treasuryInFlight;
}
