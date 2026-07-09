/**
 * Build a markdown report of all EPARTS mints and transfers for Hypha Energy.
 *
 * Usage:
 *   pnpm --filter @hypha-platform/storage-postgres exec tsx scripts/hypha-energy-eparts-activity-report.ts
 *
 * Env (loaded from apps/api/.env, apps/web/.env, repo .env):
 *   ALCHEMY_API_KEY — preferred for transfer indexing
 *   DEFAULT_DB_URL or BRANCH_DB_URL — preferred for profile lookup
 *   RPC_URL — fallback chain RPC when Alchemy key is missing
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  Alchemy,
  AssetTransfersCategory,
  Network,
  type AssetTransfersWithMetadataResult,
} from 'alchemy-sdk';
import { config as loadEnv } from 'dotenv';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseAbiItem,
} from 'viem';
import { base } from 'viem/chains';

const TOKEN_ADDRESS = '0x5d3394caa6d09214ab86cf048e39dea058ec1921';
const TREASURY_ADDRESS = '0x3a5a7b51575728cd36b8f2d30465f1e54b6df1f4';
const SPACE_SLUG = 'hypha-energy';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BASESCAN_TX = 'https://basescan.org/tx';
const PROFILE_BASE = 'https://app.hypha.earth/en/profile';
const HYPHA_API_BASE = 'https://app.hypha.earth/api/v1';
const BLOCKSCOUT_API = 'https://base.blockscout.com/api/v2';
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

type PersonRow = {
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  address: string | null;
};

type NormalizedTransfer = {
  from: string;
  to: string;
  value: string;
  symbol: string;
  timestamp: number;
  blockNumber: number;
  hash: string;
  isMint: boolean;
};

type SpaceInfo = {
  id?: number;
  slug: string;
  title: string;
};

type TokenInfo = {
  name: string;
  symbol: string;
  type?: string;
};

function loadEnvironment() {
  const repoRoot = resolve(__dirname, '../../..');
  for (const relativePath of ['.env', 'apps/web/.env', 'apps/api/.env']) {
    const envPath = resolve(repoRoot, relativePath);
    if (existsSync(envPath)) {
      loadEnv({ path: envPath, override: true });
    }
  }
}

loadEnvironment();

function hasDbUrl() {
  return Boolean(process.env.DEFAULT_DB_URL || process.env.BRANCH_DB_URL);
}

function hasAlchemyKey() {
  return Boolean(process.env.ALCHEMY_API_KEY?.trim());
}

function getAlchemy() {
  return new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.BASE_MAINNET,
    connectionInfoOverrides: {
      skipFetchSetup: true,
    },
  });
}

function getRpcClient() {
  const rpcUrl = process.env.RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

async function fetchAllTokenTransfersFromAlchemy(
  alchemy: Alchemy,
  contractAddress: string,
): Promise<AssetTransfersWithMetadataResult[]> {
  const all: AssetTransfersWithMetadataResult[] = [];
  let pageKey: string | undefined;

  do {
    const page = await alchemy.core.getAssetTransfers({
      contractAddresses: [contractAddress],
      category: [AssetTransfersCategory.ERC20],
      withMetadata: true,
      maxCount: 1000,
      pageKey,
    });
    all.push(...page.transfers);
    pageKey = page.pageKey;
    console.log(`Fetched ${all.length} Alchemy transfers so far...`);
  } while (pageKey);

  return all;
}

async function fetchAllTokenTransfersFromBlockscout(
  contractAddress: string,
): Promise<NormalizedTransfer[]> {
  const all: NormalizedTransfer[] = [];
  let nextPageParams: Record<string, string | number> | null = null;

  do {
    const url = new URL(`${BLOCKSCOUT_API}/addresses/${contractAddress}/logs`);
    url.searchParams.set('topic', TRANSFER_TOPIC);
    if (nextPageParams) {
      for (const [key, value] of Object.entries(nextPageParams)) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Blockscout request failed: ${response.status}`);
    }

    const page = (await response.json()) as {
      items: Array<{
        block_number: number;
        block_timestamp: string;
        transaction_hash: string;
        decoded?: {
          parameters?: Array<{
            name: string;
            value: string;
          }>;
        };
      }>;
      next_page_params: Record<string, string | number> | null;
    };

    for (const item of page.items) {
      const params = item.decoded?.parameters ?? [];
      const from = params.find((p) => p.name === 'from')?.value ?? '';
      const to = params.find((p) => p.name === 'to')?.value ?? '';
      const rawValue = params.find((p) => p.name === 'value')?.value ?? '0';
      all.push({
        from,
        to,
        value: formatUnits(BigInt(rawValue), 18),
        symbol: 'EPARTS',
        timestamp: Date.parse(item.block_timestamp) || 0,
        blockNumber: item.block_number,
        hash: item.transaction_hash,
        isMint: from.toLowerCase() === ZERO_ADDRESS,
      });
    }

    nextPageParams = page.next_page_params;
    console.log(`Fetched ${all.length} Blockscout transfers so far...`);
  } while (nextPageParams);

  all.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.timestamp - b.timestamp;
  });

  return all;
}

async function fetchAllTokenTransfersFromRpc(
  contractAddress: `0x${string}`,
): Promise<NormalizedTransfer[]> {
  const TRANSFER_EVENT = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  );
  const client = getRpcClient();
  const latestBlock = await client.getBlockNumber();
  const chunkSize = 9_999n;
  const fromBlock = process.env.FROM_BLOCK
    ? BigInt(process.env.FROM_BLOCK)
    : 41_000_000n;
  const logs: Awaited<ReturnType<typeof client.getLogs>> = [];

  for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
    const toBlock =
      start + chunkSize - 1n > latestBlock
        ? latestBlock
        : start + chunkSize - 1n;
    const chunk = await client.getLogs({
      address: contractAddress,
      event: TRANSFER_EVENT,
      fromBlock: start,
      toBlock,
    });
    logs.push(...chunk);
    console.log(
      `Fetched ${logs.length} RPC transfer logs through block ${toBlock}...`,
    );
  }

  const [symbol, decimals] = await Promise.all([
    client.readContract({
      address: contractAddress,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
    client.readContract({
      address: contractAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
  ]);

  const blockTimestamps = new Map<bigint, number>();
  const uniqueBlocks = [...new Set(logs.map((log) => log.blockNumber))];
  for (const blockNumber of uniqueBlocks) {
    const block = await client.getBlock({ blockNumber });
    blockTimestamps.set(blockNumber, Number(block.timestamp) * 1000);
  }

  const normalized = logs.map((log) => {
    const from = log.args.from ?? ZERO_ADDRESS;
    const to = log.args.to ?? '';
    const rawValue = log.args.value ?? 0n;
    return {
      from,
      to,
      value: formatUnits(rawValue, decimals),
      symbol,
      timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
      blockNumber: Number(log.blockNumber),
      hash: log.transactionHash,
      isMint: from.toLowerCase() === ZERO_ADDRESS,
    };
  });

  normalized.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.timestamp - b.timestamp;
  });

  return normalized;
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPersonName(person: PersonRow) {
  const fullName = [person.name, person.surname].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (person.nickname) return person.nickname;
  if (person.slug) return person.slug;
  return 'Unknown';
}

function formatTimestamp(ms: number) {
  if (!ms) return '—';
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

async function toNormalizedTransfersFromAlchemy(
  alchemy: Alchemy,
  rawTransfers: AssetTransfersWithMetadataResult[],
): Promise<NormalizedTransfer[]> {
  const metadataCache = new Map<
    string,
    { decimals: number | null; symbol: string | null }
  >();

  const getMetadata = async (
    address: string | null,
    fallback: string | null,
  ) => {
    if (!address) {
      return { decimals: 18, symbol: fallback || 'UNKNOWN' };
    }
    const key = address.toLowerCase();
    const cached = metadataCache.get(key);
    if (cached) return cached;
    const metadata = await alchemy.core.getTokenMetadata(address);
    metadataCache.set(key, metadata);
    return metadata;
  };

  const normalized = await Promise.all(
    rawTransfers.map(async (transfer) => {
      const metadata = await getMetadata(
        transfer.rawContract.address,
        transfer.asset,
      );
      const from = transfer.from;
      const to = transfer.to ?? '';
      const blockNumber = Number.parseInt(transfer.blockNum, 16);
      const timestamp = Date.parse(transfer.metadata.blockTimestamp) || 0;

      return {
        from,
        to,
        value: transfer.value ? transfer.value.toString() : '0',
        symbol: metadata.symbol ?? transfer.asset ?? 'UNKNOWN',
        timestamp,
        blockNumber,
        hash: transfer.hash,
        isMint: from.toLowerCase() === ZERO_ADDRESS,
      };
    }),
  );

  normalized.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.timestamp - b.timestamp;
  });

  return normalized;
}

async function fetchTransfers(): Promise<{
  transfers: NormalizedTransfer[];
  source: 'alchemy' | 'blockscout' | 'rpc';
}> {
  if (hasAlchemyKey()) {
    const alchemy = getAlchemy();
    const rawTransfers = await fetchAllTokenTransfersFromAlchemy(
      alchemy,
      TOKEN_ADDRESS,
    );
    return {
      transfers: await toNormalizedTransfersFromAlchemy(alchemy, rawTransfers),
      source: 'alchemy',
    };
  }

  try {
    console.log(
      'ALCHEMY_API_KEY not set — fetching transfer logs from Blockscout',
    );
    return {
      transfers: await fetchAllTokenTransfersFromBlockscout(TOKEN_ADDRESS),
      source: 'blockscout',
    };
  } catch (error) {
    console.warn('Blockscout fetch failed, falling back to RPC logs', error);
  }

  console.log('Falling back to RPC log scan via RPC_URL');
  return {
    transfers: await fetchAllTokenTransfersFromRpc(
      TOKEN_ADDRESS as `0x${string}`,
    ),
    source: 'rpc',
  };
}

async function fetchPersonFromApi(address: string): Promise<PersonRow | null> {
  const response = await fetch(
    `${HYPHA_API_BASE}/people/by-web3-address/${address}`,
  );
  if (!response.ok) return null;
  const person = (await response.json()) as {
    slug?: string;
    name?: string;
    surname?: string;
    nickname?: string;
    address?: string;
  } | null;
  if (!person?.slug) return null;
  return {
    slug: person.slug,
    name: person.name ?? null,
    surname: person.surname ?? null,
    nickname: person.nickname ?? null,
    address: person.address ?? address,
  };
}

async function loadPeopleByAddress(
  addresses: string[],
): Promise<Map<string, PersonRow>> {
  const peopleByAddress = new Map<string, PersonRow>();

  if (hasDbUrl()) {
    const { db } = await import('../src/db');
    const { people } = await import('../src/schema');
    const upperAddresses = addresses.map((a) => a.toUpperCase());
    const peopleRows = upperAddresses.length
      ? await db
          .select({
            slug: people.slug,
            name: people.name,
            surname: people.surname,
            nickname: people.nickname,
            address: people.address,
          })
          .from(people)
          .where(inArray(sql`upper(${people.address})`, upperAddresses))
      : [];

    for (const row of peopleRows) {
      if (!row.address) continue;
      peopleByAddress.set(normalizeAddress(row.address), row);
    }
    console.log(`Resolved ${peopleByAddress.size} profiles from DB`);
  } else {
    console.log(
      'DEFAULT_DB_URL not set — resolving profiles via production Hypha API',
    );
  }

  const missing = addresses.filter(
    (address) => !peopleByAddress.has(normalizeAddress(address)),
  );
  for (const address of missing) {
    const person = await fetchPersonFromApi(address);
    if (person?.address) {
      peopleByAddress.set(normalizeAddress(person.address), person);
    }
  }

  return peopleByAddress;
}

async function loadSpaceAndToken(): Promise<{
  space: SpaceInfo;
  token: TokenInfo | null;
}> {
  const fallbackSpace: SpaceInfo = {
    slug: SPACE_SLUG,
    title: 'Hypha Energy',
  };
  const fallbackToken: TokenInfo = {
    name: 'Hypha Energy Participations',
    symbol: 'EPARTS',
  };

  if (!hasDbUrl()) {
    return { space: fallbackSpace, token: fallbackToken };
  }

  const { db } = await import('../src/db');
  const { spaces, tokens } = await import('../src/schema');

  const [space] = await db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      title: spaces.title,
    })
    .from(spaces)
    .where(eq(spaces.slug, SPACE_SLUG))
    .limit(1);

  if (!space) {
    return { space: fallbackSpace, token: fallbackToken };
  }

  const [token] = await db
    .select({
      name: tokens.name,
      symbol: tokens.symbol,
      type: tokens.type,
    })
    .from(tokens)
    .where(
      sql`lower(${tokens.address}) = lower(${TOKEN_ADDRESS}) and ${tokens.spaceId} = ${space.id}`,
    )
    .limit(1);

  return {
    space: {
      id: space.id,
      slug: space.slug ?? SPACE_SLUG,
      title: space.title ?? fallbackSpace.title,
    },
    token: token ?? fallbackToken,
  };
}

function formatRecipientLabel(
  address: string,
  peopleByAddress: Map<string, PersonRow>,
) {
  const person = peopleByAddress.get(normalizeAddress(address));
  if (person) return formatPersonName(person);
  return `Unknown (${shortAddress(address)})`;
}

function renderReceipts(
  transfers: NormalizedTransfer[],
  peopleByAddress: Map<string, PersonRow>,
) {
  const receipts = transfers
    .filter(
      (t) =>
        t.to &&
        t.to.toLowerCase() !== ZERO_ADDRESS &&
        t.to.toLowerCase() !== TREASURY_ADDRESS,
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const lines = [
    '| Person | Amount | Received at (UTC) |',
    '| --- | ---: | --- |',
  ];

  for (const row of receipts) {
    lines.push(
      `| ${formatRecipientLabel(row.to, peopleByAddress)} | ${row.value} ${
        row.symbol
      } | ${formatTimestamp(row.timestamp)} |`,
    );
  }

  return lines.join('\n');
}

async function main() {
  const { space, token } = await loadSpaceAndToken();
  const { transfers, source } = await fetchTransfers();

  const recipientAddresses = Array.from(
    new Set(
      transfers
        .map((t) => t.to)
        .filter(
          (a) =>
            a &&
            a.toLowerCase() !== ZERO_ADDRESS &&
            a.toLowerCase() !== TREASURY_ADDRESS,
        ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const peopleByAddress = await loadPeopleByAddress(recipientAddresses);
  const receipts = transfers.filter(
    (t) =>
      t.to &&
      t.to.toLowerCase() !== ZERO_ADDRESS &&
      t.to.toLowerCase() !== TREASURY_ADDRESS,
  );

  const tokenLabel = token
    ? `${token.name} (${token.symbol})`
    : `Token at ${TOKEN_ADDRESS}`;
  const generatedAt = new Date().toISOString();

  const markdown = [
    `# Hypha Energy — ${tokenLabel} receipts`,
    '',
    `Token: \`${TOKEN_ADDRESS}\` · [Hypha Energy space](https://app.hypha.earth/en/dho/${SPACE_SLUG}/overview)`,
    `Generated: ${generatedAt}`,
    '',
    `${receipts.length} receipts`,
    '',
    renderReceipts(transfers, peopleByAddress),
  ].join('\n');

  const outputDir = resolve(__dirname, '../../../reports');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, 'hypha-energy-eparts-activity.md');
  writeFileSync(outputPath, markdown, 'utf8');

  console.log(`\nReport written to ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        space: space.title,
        token,
        source,
        receipts: receipts.length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
