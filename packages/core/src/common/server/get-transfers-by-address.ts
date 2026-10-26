import 'server-only';
import { getAlchemy } from './alchemy-client';
import {
  type Alchemy,
  type AssetTransfersParams,
  type AssetTransfersWithMetadataResult,
  AssetTransfersCategory,
  SortingOrder,
} from 'alchemy-sdk';
import { isVisibleWalletToken, TOKENS } from '../web3/tokens';

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
   * When set, inbound spam is dropped before `getTokenMetadata` and Alchemy
   * is optionally scoped to the allowlist (plus catalogue stables / HYPHA).
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

function uniqueLowercased(addresses: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(addresses)
        .map((address) => address.toLowerCase())
        .filter((address) => address.length > 0),
    ),
  );
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

/**
 * Contract filters for Alchemy. An explicit `token=` query wins. Otherwise a
 * known-address set is sent in 45-address batches so spam airdrops never
 * enter the result set. Catalogue tokens are always included in that set
 * because {@link isVisibleWalletToken} allows them even when they are absent
 * from `knownAddresses`.
 */
function resolveContractBatches(
  contractAddresses: string[] | undefined,
  knownAddresses?: ReadonlySet<string>,
): Array<string[] | undefined> {
  if (contractAddresses && contractAddresses.length > 0) {
    return chunkAddresses(
      uniqueLowercased(contractAddresses),
      ALCHEMY_CONTRACT_BATCH_SIZE,
    );
  }
  if (!knownAddresses) {
    return [undefined];
  }
  const queryAddresses = new Set<string>();
  for (const address of knownAddresses) {
    if (isVisibleWalletToken(address, knownAddresses)) {
      queryAddresses.add(address.toLowerCase());
    }
  }
  for (const token of TOKENS) {
    if (isVisibleWalletToken(token.address, knownAddresses)) {
      queryAddresses.add(token.address.toLowerCase());
    }
  }
  const list = Array.from(queryAddresses);
  return list.length === 0
    ? [undefined]
    : chunkAddresses(list, ALCHEMY_CONTRACT_BATCH_SIZE);
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

async function fetchAssetTransferPages(
  alchemy: Alchemy,
  base: Pick<
    AssetTransfersParams,
    'fromAddress' | 'toAddress' | 'contractAddresses' | 'fromBlock' | 'toBlock'
  >,
  options: {
    knownAddresses?: ReadonlySet<string>;
    limit?: number;
  },
): Promise<AssetTransfersWithMetadataResult[]> {
  const collected: AssetTransfersWithMetadataResult[] = [];
  let pageKey: string | undefined;
  let pages = 0;

  do {
    const response = await alchemy.core.getAssetTransfers({
      ...base,
      category: [AssetTransfersCategory.ERC20],
      withMetadata: true,
      order: SortingOrder.DESCENDING,
      maxCount: ALCHEMY_PAGE_SIZE,
      pageKey,
    });
    collected.push(...(response.transfers ?? []));
    pageKey = response.pageKey;
    pages += 1;
    if (hasEnoughVisible(collected, options.knownAddresses, options.limit)) {
      break;
    }
  } while (pageKey && pages < ALCHEMY_MAX_PAGES);

  return collected;
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
  const hexFromBlock = toHexBlock(fromBlock);
  const hexToBlock = toHexBlock(toBlock);
  const contractBatches = resolveContractBatches(
    contractAddresses,
    knownAddresses,
  );

  const pages = await Promise.all(
    contractBatches.flatMap((batch) => [
      fetchAssetTransferPages(
        alchemy,
        {
          fromAddress: address,
          contractAddresses: batch,
          fromBlock: hexFromBlock,
          toBlock: hexToBlock,
        },
        { knownAddresses, limit },
      ),
      fetchAssetTransferPages(
        alchemy,
        {
          toAddress: address,
          contractAddresses: batch,
          fromBlock: hexFromBlock,
          toBlock: hexToBlock,
        },
        { knownAddresses, limit },
      ),
    ]),
  );

  const rawTransfers = pages
    .flat()
    .filter((transfer) => isAllowlistedRaw(transfer, knownAddresses));

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

  const mints = await alchemy.core.getAssetTransfers({
    fromAddress: ZERO_ADDRESS,
    category: [AssetTransfersCategory.ERC20],
    contractAddresses,
    withMetadata: true,
    // Alchemy expects block bounds as 0x-prefixed hex strings.
    fromBlock: toHexBlock(fromBlock),
    toBlock: toHexBlock(toBlock),
    // Alchemy defaults to ascending (oldest first), so a bounded page would
    // contain only the oldest mints and newly minted transfers would never
    // appear. Request newest-first so the page holds the most recent mints.
    order: SortingOrder.DESCENDING,
    // Bound the result set when the caller requested a limit. When undefined,
    // Alchemy falls back to its page maximum (1000), matching the behavior of
    // the address-based queries above.
    maxCount: limit,
  });

  return toTransfersWithMetadata(alchemy, mints.transfers);
}
