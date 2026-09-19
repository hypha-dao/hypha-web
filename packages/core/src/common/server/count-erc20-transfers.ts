import 'server-only';

import {
  AssetTransfersCategory,
  SortingOrder,
  type AssetTransfersWithMetadataResult,
} from 'alchemy-sdk';
import { getAlchemy } from './alchemy-client';
import {
  NETWORK_DASHBOARD_MONTHS,
  utcMonthKeys,
  type MonthlyCount,
} from '../../space/network-dashboard';

const TRANSFER_PAGE_SIZE = 1000;
const MAX_TRANSFER_PAGES = 40;
const CONTRACT_BATCH_SIZE = 25;

export type Erc20TransferCount = {
  total: number;
  byMonth: MonthlyCount[];
  complete: boolean;
};

function monthKeyFromTimestamp(timestampMs: number): string | null {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
  const date = new Date(timestampMs);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

export function tallyTransfersByMonth(
  transfers: ReadonlyArray<Pick<AssetTransfersWithMetadataResult, 'metadata'>>,
  months: readonly string[],
): { inWindow: Map<string, number>; olderThanWindow: number } {
  const monthSet = new Set(months);
  const oldest = months[0];
  const inWindow = new Map<string, number>(months.map((month) => [month, 0]));
  let olderThanWindow = 0;

  for (const transfer of transfers) {
    const timestampMs = Date.parse(transfer.metadata?.blockTimestamp ?? '');
    const month = monthKeyFromTimestamp(timestampMs);
    if (!month) continue;
    if (monthSet.has(month)) {
      inWindow.set(month, (inWindow.get(month) ?? 0) + 1);
      continue;
    }
    if (oldest && month < oldest) {
      olderThanWindow += 1;
    }
  }

  return { inWindow, olderThanWindow };
}

/**
 * Count ERC-20 transfers for the given contracts (newest first).
 * Used for the network dashboard Transactions KPI — not governance events.
 */
export async function countErc20TransfersForContracts(
  contractAddresses: readonly string[],
  options: { now?: Date } = {},
): Promise<Erc20TransferCount> {
  const months = utcMonthKeys(NETWORK_DASHBOARD_MONTHS, options.now);
  const empty: Erc20TransferCount = {
    total: 0,
    byMonth: months.map((month) => ({ month, count: 0 })),
    complete: true,
  };

  const unique = [
    ...new Set(
      contractAddresses
        .map((address) => address.trim().toLowerCase())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  ];
  if (unique.length === 0) return empty;
  if (!process.env.ALCHEMY_API_KEY) {
    return { ...empty, complete: false };
  }

  const alchemy = getAlchemy();
  const inWindow = new Map<string, number>(months.map((month) => [month, 0]));
  let total = 0;
  let complete = true;

  for (let index = 0; index < unique.length; index += CONTRACT_BATCH_SIZE) {
    const batch = unique.slice(index, index + CONTRACT_BATCH_SIZE);
    let pageKey: string | undefined;
    let pages = 0;

    do {
      const response = await alchemy.core.getAssetTransfers({
        fromBlock: '0x0',
        category: [AssetTransfersCategory.ERC20],
        contractAddresses: batch,
        excludeZeroValue: true,
        withMetadata: true,
        order: SortingOrder.DESCENDING,
        maxCount: TRANSFER_PAGE_SIZE,
        pageKey,
      });
      const page = response.transfers ?? [];
      total += page.length;
      const tallied = tallyTransfersByMonth(page, months);
      for (const [month, count] of tallied.inWindow) {
        inWindow.set(month, (inWindow.get(month) ?? 0) + count);
      }
      pageKey = response.pageKey;
      pages += 1;
    } while (pageKey && pages < MAX_TRANSFER_PAGES);

    if (pageKey) complete = false;
  }

  return {
    total,
    byMonth: months.map((month) => ({
      month,
      count: inWindow.get(month) ?? 0,
    })),
    complete,
  };
}

export function transferCountBeforeWindow(
  total: number,
  byMonth: readonly MonthlyCount[],
): number {
  const inWindow = byMonth.reduce((sum, point) => sum + point.count, 0);
  return Math.max(0, total - inWindow);
}
