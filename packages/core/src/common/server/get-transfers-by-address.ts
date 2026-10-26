import 'server-only';
import { getAlchemy } from './alchemy-client';
import {
  type Alchemy,
  type AssetTransfersWithMetadataParams,
  type AssetTransfersWithMetadataResult,
  AssetTransfersCategory,
  SortingOrder,
} from 'alchemy-sdk';
import { getAddress, isAddress } from 'viem';
import { isVisibleWalletToken } from '../web3/tokens';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Alchemy `getAssetTransfers` page size (SDK maximum). */
const ALCHEMY_PAGE_SIZE = 1000;
/** Hard cap so a spam-heavy wallet cannot walk unbounded history. */
const ALCHEMY_MAX_PAGES = 8;
/** Alchemy rejects more than 45 `contractAddresses` per request. */
const ALCHEMY_CONTRACT_BATCH_SIZE = 45;

export type GetTransfersByAddressParams = {
  address: string;
  contractAddresses?: string[];
  fromDate?: Date;
  toDate?: Date;
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
  /**
   * When set, inbound spam is dropped before `getTokenMetadata`.
   * Not forwarded to Alchemy as `contractAddresses` — a long or dirty
   * allowlist 400s `alchemy_getAssetTransfers` (space treasury omits it
   * and succeeds).
   */
  knownAddresses?: ReadonlySet<string>;
};

export type Transfer = {
  from: string;
  to: string;
  value: string;
  symbol: string;
  decimals: number;
  token: string;
  timestamp: number;
  block_number: number;
  transaction_index: number;
  transaction_hash: string;
};

function toHexBlock(block?: number): string | undefined {
  return block === undefined ? undefined : `0x${block.toString(16)}`;
}

function chunkAddresses(addresses: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < addresses.length; index += size) {
    batches.push(addresses.slice(index, index + size));
  }
  return batches;
}

function checksumContractAddresses(addresses: string[]): string[] {
  const unique = new Set<string>();
  for (const address of addresses) {
    if (!isAddress(address, { strict: false })) {
      continue;
    }
    unique.add(getAddress(address));
  }
  return Array.from(unique);
}

function checksumWalletAddress(address: string): string {
  if (!isAddress(address, { strict: false })) {
    throw new Error(`Invalid wallet address: ${address}`);
  }
  return getAddress(address);
}

/**
 * Explicit `token=` query only. A large DB allowlist must not be sent —
 * Alchemy 400s on too many addresses or any invalid entry.
 */
function resolveContractBatches(
  contractAddresses: string[] | undefined,
): Array<string[] | undefined> {
  if (!contractAddresses || contractAddresses.length === 0) {
    return [undefined];
  }
  const sanitized = checksumContractAddresses(contractAddresses);
  return sanitized.length === 0
    ? [undefined]
    : chunkAddresses(sanitized, ALCHEMY_CONTRACT_BATCH_SIZE);
}

function isAllowlistedRaw(
  transfer: AssetTransfersWithMetadataResult,
  knownAddresses?: ReadonlySet<string>,
): boolean {
  if (!knownAddresses) {
    return true;
  }
  return isVisibleWalletToken(transfer.rawContract.address, knownAddresses);
}

function hasEnoughVisible(
  transfers: AssetTransfersWithMetadataResult[],
  knownAddresses: ReadonlySet<string> | undefined,
  limit: number | undefined,
): boolean {
  if (limit == null) {
    return false;
  }
  const visible = knownAddresses
    ? transfers.filter((transfer) => isAllowlistedRaw(transfer, knownAddresses))
    : transfers;
  return visible.length >= limit;
}

/**
 * Build Alchemy params with only defined keys. The SDK Object.assigns the
 * whole object into JSON-RPC; `null`/`undefined` `pageKey` or
 * `contractAddresses` have 400'd `alchemy_getAssetTransfers`.
 */
function buildAssetTransferParams(params: {
  fromAddress?: string;
  toAddress?: string;
  contractAddresses?: string[];
  fromBlock?: string;
  toBlock?: string;
  pageKey?: string;
}): AssetTransfersWithMetadataParams {
  const request: AssetTransfersWithMetadataParams = {
    category: [AssetTransfersCategory.ERC20],
    withMetadata: true,
    order: SortingOrder.DESCENDING,
    maxCount: ALCHEMY_PAGE_SIZE,
  };
  if (params.fromAddress) {
    request.fromAddress = params.fromAddress;
  }
  if (params.toAddress) {
    request.toAddress = params.toAddress;
  }
  if (params.contractAddresses && params.contractAddresses.length > 0) {
    request.contractAddresses = params.contractAddresses;
  }
  if (params.fromBlock) {
    request.fromBlock = params.fromBlock;
  }
  if (params.toBlock) {
    request.toBlock = params.toBlock;
  }
  if (params.pageKey) {
    request.pageKey = params.pageKey;
  }
  return request;
}

async function fetchAssetTransferPages(
  alchemy: Alchemy,
  base: {
    fromAddress?: string;
    toAddress?: string;
    contractAddresses?: string[];
    fromBlock?: string;
    toBlock?: string;
  },
  options: {
    knownAddresses?: ReadonlySet<string>;
    limit?: number;
  },
): Promise<{
  transfers: AssetTransfersWithMetadataResult[];
  failed: boolean;
}> {
  const collected: AssetTransfersWithMetadataResult[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  let failed = false;

  do {
    try {
      const response = await alchemy.core.getAssetTransfers(
        buildAssetTransferParams({ ...base, pageKey }),
      );
      collected.push(...(response.transfers ?? []));
      pageKey = response.pageKey;
    } catch (error) {
      console.warn('Alchemy getAssetTransfers failed', error);
      failed = true;
      break;
    }
    pages += 1;
    if (hasEnoughVisible(collected, options.knownAddresses, options.limit)) {
      break;
    }
  } while (pageKey && pages < ALCHEMY_MAX_PAGES);

  return { transfers: collected, failed };
}

/**
 * Normalizes raw Alchemy asset transfers into {@link Transfer} objects,
 * enriching each with token symbol/decimals and sorting newest-block first.
 * A single metadata failure is isolated so one spam or 429 cannot 500 the
 * whole list.
 *
 * @param alchemy - Alchemy SDK instance used to resolve token metadata.
 * @param rawTransfers - Raw ERC-20 transfers returned by `getAssetTransfers`.
 * @returns The transfers with resolved metadata, sorted by descending block number.
 */
async function toTransfersWithMetadata(
  alchemy: Alchemy,
  rawTransfers: AssetTransfersWithMetadataResult[],
): Promise<Transfer[]> {
  // Cache the in-flight promise so concurrent rows for the same contract
  // share one `getTokenMetadata` call.
  const metadataCache = new Map<
    string,
    Promise<{ decimals: number | null; symbol: string | null }>
  >();

  const getMetadata = (
    address: string | null,
    fallbackAsset: string | null,
  ) => {
    if (!address) {
      return Promise.resolve({
        decimals: 18,
        symbol: fallbackAsset || 'UNKNOWN',
      });
    }
    const key = address.toLowerCase();
    const cached = metadataCache.get(key);
    if (cached) {
      return cached;
    }
    const pending = alchemy.core
      .getTokenMetadata(address)
      .catch((error: unknown) => {
        console.warn(`Skipping token metadata for ${address}`, error);
        return {
          decimals: 18,
          symbol: fallbackAsset || 'UNKNOWN',
        };
      });
    metadataCache.set(key, pending);
    return pending;
  };

  const transfersWithData = await Promise.all(
    rawTransfers.map(async (transfer) => {
      const blockNumber = parseInt(transfer.blockNum, 16);
      const timestamp = Date.parse(transfer.metadata.blockTimestamp) || 0;

      const tokenMetadata = await getMetadata(
        transfer.rawContract.address,
        transfer.asset,
      );

      return {
        from: transfer.from,
        to: transfer.to ?? '',
        value: transfer.value ? transfer.value.toString() : '0',
        symbol: tokenMetadata.symbol ?? transfer.asset ?? 'UNKNOWN',
        decimals: tokenMetadata.decimals ?? 18,
        token: transfer.rawContract.address ?? '',
        timestamp,
        block_number: blockNumber,
        transaction_index: 0,
        transaction_hash: transfer.hash,
      };
    }),
  );

  transfersWithData.sort((a, b) => {
    return b.block_number - a.block_number;
  });

  return transfersWithData;
}

function applyDateWindow(
  transfers: Transfer[],
  fromDate?: Date,
  toDate?: Date,
) {
  const fromTime = fromDate?.getTime();
  const toTime = toDate?.getTime();
  if (fromTime === undefined && toTime === undefined) {
    return transfers;
  }
  return transfers.filter(
    (transfer) =>
      (fromTime === undefined || transfer.timestamp >= fromTime) &&
      (toTime === undefined || transfer.timestamp <= toTime),
  );
}

/**
 * Fetches ERC-20 transfers where the given address is either sender or
 * recipient, merging both directions into a single metadata-enriched list.
 *
 * When `knownAddresses` is provided, allowlisted rows are selected before
 * metadata so inbound spam cannot 429/500 the response. Alchemy is queried
 * newest-first with hex block bounds and `pageKey` until enough visible
 * rows exist or the page cap is hit.
 *
 * @param params - Address plus optional contract/date/block filters.
 * @returns The combined inbound and outbound transfers, newest block first.
 */
export async function getTransfersByAddress(
  params: GetTransfersByAddressParams,
): Promise<Transfer[]> {
  const {
    address,
    contractAddresses,
    fromDate,
    toDate,
    fromBlock,
    toBlock,
    limit,
    knownAddresses,
  } = params;
  const alchemy = getAlchemy();
  const wallet = checksumWalletAddress(address);
  const hexFromBlock = toHexBlock(fromBlock);
  const hexToBlock = toHexBlock(toBlock);
  const contractBatches = resolveContractBatches(contractAddresses);

  const pages = await Promise.all(
    contractBatches.flatMap((batch) => [
      fetchAssetTransferPages(
        alchemy,
        {
          fromAddress: wallet,
          contractAddresses: batch,
          fromBlock: hexFromBlock,
          toBlock: hexToBlock,
        },
        { knownAddresses, limit },
      ),
      fetchAssetTransferPages(
        alchemy,
        {
          toAddress: wallet,
          contractAddresses: batch,
          fromBlock: hexFromBlock,
          toBlock: hexToBlock,
        },
        { knownAddresses, limit },
      ),
    ]),
  );

  const rawTransfers = pages
    .flatMap((page) => page.transfers)
    .filter((transfer) => isAllowlistedRaw(transfer, knownAddresses));

  if (rawTransfers.length === 0 && pages.every((page) => page.failed)) {
    throw new Error('Alchemy getAssetTransfers failed for every request');
  }

  const withMetadata = await toTransfersWithMetadata(alchemy, rawTransfers);
  const inWindow = applyDateWindow(withMetadata, fromDate, toDate);
  return limit == null ? inWindow : inWindow.slice(0, limit);
}

/**
 * Returns mint events (ERC-20 `Transfer` from the zero address) for the given
 * token contracts, regardless of recipient.
 *
 * Mints don't reference the minting space anywhere in the Transfer event, so
 * address-based queries can't find them; querying by the space's own token
 * contracts is the way to surface tokens a space minted to other accounts
 * (e.g. airdrops to members).
 */
export async function getMintTransfersByTokens({
  contractAddresses,
  fromBlock,
  toBlock,
  limit,
}: {
  contractAddresses: string[];
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
}): Promise<Transfer[]> {
  if (contractAddresses.length === 0) {
    return [];
  }
  const alchemy = getAlchemy();
  const sanitized = checksumContractAddresses(contractAddresses);
  if (sanitized.length === 0) {
    return [];
  }

  const request: AssetTransfersWithMetadataParams = {
    fromAddress: ZERO_ADDRESS,
    category: [AssetTransfersCategory.ERC20],
    contractAddresses: sanitized,
    withMetadata: true,
    order: SortingOrder.DESCENDING,
  };
  const hexFromBlock = toHexBlock(fromBlock);
  const hexToBlock = toHexBlock(toBlock);
  if (hexFromBlock) {
    request.fromBlock = hexFromBlock;
  }
  if (hexToBlock) {
    request.toBlock = hexToBlock;
  }
  if (limit != null) {
    request.maxCount = limit;
  }

  const mints = await alchemy.core.getAssetTransfers(request);

  return toTransfersWithMetadata(alchemy, mints.transfers);
}
