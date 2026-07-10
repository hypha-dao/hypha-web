/**
 * Build a Markdown + CSV leaderboard for Belica (or any space) competition scoring.
 *
 * Usage:
 *   pnpm --filter @hypha-platform/storage-postgres exec tsx scripts/belica-competition-leaderboard.ts \
 *     --start 2026-07-01T00:00:00Z \
 *     --end 2026-07-31T23:59:59Z \
 *     --space-slug belica
 *
 * Env (loaded from apps/api/.env, apps/web/.env, repo .env):
 *   ALCHEMY_API_KEY — preferred RPC provider
 *   DEFAULT_DB_URL or BRANCH_DB_URL — space + profile lookup
 *   RPC_URL — fallback chain RPC
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Log,
  type PublicClient,
} from 'viem';
import { base } from 'viem/chains';

import {
  daoProposalsImplementationAddress,
  daoSpaceFactoryImplementationAddress,
} from '../../core/src/generated';

const HYPHA_API_BASE = 'https://app.hypha.earth/api/v1';
const BASESCAN_TX = 'https://basescan.org/tx';
const PROFILE_BASE = 'https://app.hypha.earth/en/profile';
const DEFAULT_SPACE_SLUG = 'belica';
function getLogChunkSize(useAlchemyForLogs: boolean): bigint {
  const fromEnv = process.env.LOG_CHUNK_SIZE?.trim();
  if (fromEnv) {
    const parsed = BigInt(fromEnv);
    if (parsed > 0n) return parsed;
  }
  // Alchemy free tier allows at most 10 blocks per eth_getLogs request.
  if (useAlchemyForLogs) {
    return 10n;
  }
  return 9_999n;
}

function getRpcClient(options?: { forLogs?: boolean }): PublicClient {
  const forLogs = options?.forLogs ?? false;
  const alchemyKey = process.env.ALCHEMY_API_KEY?.trim();
  const rpcUrlFromEnv = process.env.RPC_URL?.trim();

  let rpcUrl: string;
  let label: string;

  if (forLogs && rpcUrlFromEnv) {
    rpcUrl = rpcUrlFromEnv;
    label = 'RPC_URL (log scan)';
  } else if (alchemyKey) {
    rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    label = forLogs
      ? 'Alchemy Base mainnet (log scan)'
      : 'Alchemy Base mainnet';
  } else {
    rpcUrl = rpcUrlFromEnv || 'https://mainnet.base.org';
    label = rpcUrl;
  }

  console.log(`Using RPC${forLogs ? ' for logs' : ''}: ${label}`);

  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

const SYSTEM_ADDRESSES = new Set(
  [
    daoProposalsImplementationAddress[8453],
    daoSpaceFactoryImplementationAddress[8453],
    '0x0000000000000000000000000000000000000000',
  ].map((address) => address.toLowerCase()),
);

const POINTS = {
  vote: 1,
  join: 3,
  proposal: 2,
  accepted: 3,
} as const;

const PROPOSAL_CREATED_EVENT = parseAbiItem(
  'event ProposalCreated(uint256 indexed proposalId, uint256 indexed spaceId, uint256 startTime, uint256 duration, address creator, bytes executionData)',
);
const VOTE_CAST_EVENT = parseAbiItem(
  'event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower)',
);
const PROPOSAL_EXECUTED_EVENT = parseAbiItem(
  'event ProposalExecuted(uint256 indexed proposalId, bool passed, uint256 yesVotes, uint256 noVotes)',
);
const MEMBER_JOINED_EVENT = parseAbiItem(
  'event MemberJoined(uint256 indexed spaceId, address indexed memberAddress)',
);

const proposalCoreAbi = [
  {
    inputs: [{ name: '_proposalId', type: 'uint256' }],
    name: 'getProposalCore',
    outputs: [
      { name: 'spaceId', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'executed', type: 'bool' },
      { name: 'expired', type: 'bool' },
      { name: 'yesVotes', type: 'uint256' },
      { name: 'noVotes', type: 'uint256' },
      { name: 'totalVotingPowerAtSnapshot', type: 'uint256' },
      { name: 'creator', type: 'address' },
      {
        name: 'transactions',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type PersonRow = {
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  address: string | null;
};

type SpaceInfo = {
  id: number;
  slug: string;
  title: string;
  web3SpaceId: number;
  createdAt?: string | null;
};

type ScoreLineItem = {
  type: 'vote' | 'join' | 'proposal' | 'accepted';
  points: number;
  timestampMs: number;
  txHash: string;
  detail: string;
};

type AddressScore = {
  votePts: number;
  joinPts: number;
  proposalPts: number;
  acceptedPts: number;
  lineItems: ScoreLineItem[];
};

type CliArgs = {
  start: Date;
  end: Date;
  spaceSlug: string;
  outputMd: string;
  outputCsv: string;
  fromBlock?: bigint;
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

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      i += 1;
    } else {
      parsed[key] = 'true';
    }
  }

  if (!parsed.start || !parsed.end) {
    console.error(
      'Usage: tsx scripts/belica-competition-leaderboard.ts --start ISO8601 --end ISO8601 [--space-slug belica]',
    );
    process.exit(1);
  }

  const start = new Date(parsed.start);
  const end = new Date(parsed.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    console.error('Invalid --start or --end date');
    process.exit(1);
  }
  if (start >= end) {
    console.error('--start must be before --end');
    process.exit(1);
  }

  const spaceSlug = parsed['space-slug'] ?? DEFAULT_SPACE_SLUG;
  const outputDir = resolve(__dirname, '../../../reports');
  const outputMd =
    parsed['output-md'] ??
    resolve(outputDir, 'belica-competition-leaderboard.md');
  const outputCsv =
    parsed['output-csv'] ??
    resolve(outputDir, 'belica-competition-leaderboard.csv');

  return {
    start,
    end,
    spaceSlug,
    outputMd,
    outputCsv,
    fromBlock: parsed['from-block'] ? BigInt(parsed['from-block']) : undefined,
  };
}

function hasDbUrl() {
  return Boolean(process.env.DEFAULT_DB_URL || process.env.BRANCH_DB_URL);
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function isSystemAddress(address: string) {
  return SYSTEM_ADDRESSES.has(normalizeAddress(address));
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

function isWithinWindow(ms: number, start: Date, end: Date) {
  return ms >= start.getTime() && ms < end.getTime();
}

async function findBlockByTimestamp(
  client: PublicClient,
  targetSec: number,
  mode: 'start' | 'end',
): Promise<bigint> {
  let low = 0n;
  let high = await client.getBlockNumber();

  while (low < high) {
    const mid = low + (high - low) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    const blockSec = Number(block.timestamp);

    if (mode === 'start') {
      if (blockSec < targetSec) {
        low = mid + 1n;
      } else {
        high = mid;
      }
    } else if (blockSec <= targetSec) {
      low = mid + 1n;
    } else {
      high = mid;
    }
  }

  return low;
}

async function fetchLogsInChunks<TEvent extends typeof PROPOSAL_CREATED_EVENT>({
  client,
  address,
  event,
  fromBlock,
  toBlock,
  args,
  useAlchemyForLogs = false,
}: {
  client: PublicClient;
  address: `0x${string}`;
  event: TEvent;
  fromBlock: bigint;
  toBlock: bigint;
  args?: Record<string, bigint>;
  useAlchemyForLogs?: boolean;
}): Promise<Log<bigint, number, false, TEvent>[]> {
  const logs: Log<bigint, number, false, TEvent>[] = [];

  const chunkSize = getLogChunkSize(useAlchemyForLogs);
  const logProgressEvery = chunkSize <= 10n ? 500 : 1;

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end =
      start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;

    let chunk: Log<bigint, number, false, TEvent>[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        chunk = await client.getLogs({
          address,
          event,
          args,
          fromBlock: start,
          toBlock: end,
        });
        break;
      } catch (error) {
        const isRateLimit =
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.includes('rate limit'));
        if (!isRateLimit || attempt === 4) throw error;
        const delayMs = 500 * 2 ** attempt;
        console.warn(
          `Rate limited fetching ${event.name}; retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    logs.push(...chunk);
    if (logs.length % logProgressEvery === 0 || end === toBlock) {
      console.log(
        `Fetched ${logs.length} ${event.name} logs through block ${end}...`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, chunkSize <= 10n ? 20 : 75),
    );
  }

  return logs;
}

async function loadBlockTimestamps(
  client: PublicClient,
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers)];
  const timestamps = new Map<bigint, number>();

  for (const blockNumber of unique) {
    const block = await client.getBlock({ blockNumber });
    timestamps.set(blockNumber, Number(block.timestamp) * 1000);
  }

  return timestamps;
}

type ProposalCore = {
  spaceId: bigint;
  creator: `0x${string}`;
};

async function loadProposalCores(
  client: PublicClient,
  proposalIds: bigint[],
): Promise<Map<string, ProposalCore>> {
  const daoProposalsAddress =
    daoProposalsImplementationAddress[8453] as `0x${string}`;
  const result = new Map<string, ProposalCore>();

  for (const proposalId of proposalIds) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const core = await client.readContract({
          address: daoProposalsAddress,
          abi: proposalCoreAbi,
          functionName: 'getProposalCore',
          args: [proposalId],
        });
        result.set(proposalId.toString(), {
          spaceId: core[0],
          creator: core[8],
        });
        break;
      } catch (error) {
        const isRateLimit =
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.includes('rate limit'));
        if (!isRateLimit || attempt === 4) throw error;
        const delayMs = 500 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return result;
}

async function loadSpaceFromApi(slug: string): Promise<SpaceInfo | null> {
  const response = await fetch(`${HYPHA_API_BASE}/spaces/${slug}`);
  if (!response.ok) return null;
  const space = (await response.json()) as {
    id?: number;
    slug?: string;
    title?: string;
    web3SpaceId?: number | null;
  };
  if (!space.id || !space.web3SpaceId) return null;
  return {
    id: space.id,
    slug: space.slug ?? slug,
    title: space.title ?? slug,
    web3SpaceId: space.web3SpaceId,
    createdAt: space.createdAt ?? null,
  };
}

async function loadSpace(slug: string): Promise<SpaceInfo> {
  if (hasDbUrl()) {
    const { db } = await import('../src/db');
    const { spaces } = await import('../src/schema');
    const [space] = await db
      .select({
        id: spaces.id,
        slug: spaces.slug,
        title: spaces.title,
        web3SpaceId: spaces.web3SpaceId,
        createdAt: spaces.createdAt,
      })
      .from(spaces)
      .where(eq(spaces.slug, slug))
      .limit(1);

    if (space?.web3SpaceId) {
      return {
        id: space.id,
        slug: space.slug,
        title: space.title ?? slug,
        web3SpaceId: space.web3SpaceId,
        createdAt: space.createdAt?.toISOString() ?? null,
      };
    }
  }

  const fromApi = await loadSpaceFromApi(slug);
  if (fromApi) return fromApi;

  throw new Error(
    `Could not resolve space "${slug}" with web3SpaceId (set DEFAULT_DB_URL or use production API)`,
  );
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
  if (!person?.address && !person?.slug) return null;
  return {
    slug: person.slug ?? null,
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

async function loadDbProposalIds(spaceId: number): Promise<Set<string>> {
  if (!hasDbUrl()) return new Set();

  const { db } = await import('../src/db');
  const { documents } = await import('../src/schema');

  const rows = await db
    .select({ web3ProposalId: documents.web3ProposalId })
    .from(documents)
    .where(eq(documents.spaceId, spaceId));

  const ids = new Set<string>();
  for (const row of rows) {
    if (row.web3ProposalId && row.web3ProposalId > 0) {
      ids.add(String(row.web3ProposalId));
    }
  }

  console.log(`Loaded ${ids.size} proposal ids from DB documents`);
  return ids;
}

async function loadDbProposalCreators(
  spaceId: number,
): Promise<Map<string, `0x${string}`>> {
  const creators = new Map<string, `0x${string}`>();
  if (!hasDbUrl()) return creators;

  const { db } = await import('../src/db');
  const { documents, people } = await import('../src/schema');
  const rows = await db
    .select({
      web3ProposalId: documents.web3ProposalId,
      address: people.address,
    })
    .from(documents)
    .innerJoin(people, eq(documents.creatorId, people.id))
    .where(eq(documents.spaceId, spaceId));

  for (const row of rows) {
    if (row.web3ProposalId && row.web3ProposalId > 0 && row.address) {
      creators.set(String(row.web3ProposalId), row.address as `0x${string}`);
    }
  }

  console.log(`Loaded ${creators.size} proposal creators from DB`);
  return creators;
}

async function loadProposalCreatorsFromApi(
  spaceSlug: string,
): Promise<Map<string, `0x${string}`>> {
  const creators = new Map<string, `0x${string}`>();
  const response = await fetch(
    `${HYPHA_API_BASE}/spaces/${spaceSlug}/documents/all`,
  );
  if (!response.ok) {
    console.warn(
      `Could not load documents from API (${response.status}) — chain creators only`,
    );
    return creators;
  }

  const payload = await response.json();
  const documents = (
    Array.isArray(payload)
      ? payload
      : (payload as { documents?: unknown[] }).documents ?? []
  ) as Array<{
    web3ProposalId?: number | null;
    creator?: { address?: string | null };
  }>;
  for (const document of documents) {
    if (
      document.web3ProposalId &&
      document.web3ProposalId > 0 &&
      document.creator?.address
    ) {
      creators.set(
        String(document.web3ProposalId),
        document.creator.address as `0x${string}`,
      );
    }
  }

  console.log(`Loaded ${creators.size} proposal creators from Hypha API`);
  return creators;
}

function resolveCreatorAddress(
  proposalId: string,
  chainCreator: `0x${string}` | undefined,
  creatorByProposalId: Map<string, `0x${string}`>,
): `0x${string}` | null {
  const fromIndex = creatorByProposalId.get(proposalId);
  if (fromIndex && !isSystemAddress(fromIndex)) return fromIndex;
  if (chainCreator && !isSystemAddress(chainCreator)) return chainCreator;
  if (fromIndex) return fromIndex;
  return chainCreator ?? null;
}

async function resolveProposalActor(
  client: PublicClient,
  txHash: `0x${string}`,
  proposalId: string,
  chainCreator: `0x${string}` | undefined,
  creatorByProposalId: Map<string, `0x${string}`>,
  txFromCache: Map<string, `0x${string}`>,
): Promise<`0x${string}` | null> {
  const indexed = resolveCreatorAddress(
    proposalId,
    chainCreator,
    creatorByProposalId,
  );
  if (indexed && !isSystemAddress(indexed)) return indexed;

  const cached = txFromCache.get(txHash);
  if (cached && !isSystemAddress(cached)) return cached;

  const tx = await client.getTransaction({ hash: txHash });
  txFromCache.set(txHash, tx.from);
  return isSystemAddress(tx.from) ? null : tx.from;
}

async function loadDbJoinEvents(
  spaceId: number,
  start: Date,
  end: Date,
): Promise<Array<{ memberAddress: string; createdAt: Date; id: number }>> {
  if (!hasDbUrl()) return [];

  const { db } = await import('../src/db');
  const { events } = await import('../src/schema');

  const rows = await db
    .select({
      id: events.id,
      createdAt: events.createdAt,
      parameters: events.parameters,
    })
    .from(events)
    .where(
      and(
        eq(events.type, 'joinSpace'),
        eq(events.referenceEntity, 'space'),
        eq(events.referenceId, spaceId),
        gte(events.createdAt, start),
        lt(events.createdAt, end),
      ),
    );

  return rows
    .map((row) => {
      const params = row.parameters as { memberAddress?: string };
      const memberAddress = params.memberAddress;
      if (!memberAddress) return null;
      return {
        id: row.id,
        createdAt: row.createdAt,
        memberAddress,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

function getOrCreateScore(
  ledger: Map<string, AddressScore>,
  address: string,
): AddressScore {
  const key = normalizeAddress(address);
  const existing = ledger.get(key);
  if (existing) return existing;

  const created: AddressScore = {
    votePts: 0,
    joinPts: 0,
    proposalPts: 0,
    acceptedPts: 0,
    lineItems: [],
  };
  ledger.set(key, created);
  return created;
}

function addPoints(
  ledger: Map<string, AddressScore>,
  address: string,
  type: ScoreLineItem['type'],
  points: number,
  lineItem: Omit<ScoreLineItem, 'type' | 'points'>,
) {
  if (isSystemAddress(address)) {
    return;
  }

  const score = getOrCreateScore(ledger, address);
  score.lineItems.push({ type, points, ...lineItem });

  switch (type) {
    case 'vote':
      score.votePts += points;
      break;
    case 'join':
      score.joinPts += points;
      break;
    case 'proposal':
      score.proposalPts += points;
      break;
    case 'accepted':
      score.acceptedPts += points;
      break;
    default:
      break;
  }
}

function formatPersonLabel(
  address: string,
  peopleByAddress: Map<string, PersonRow>,
) {
  const person = peopleByAddress.get(normalizeAddress(address));
  if (person) return formatPersonName(person);
  return `Unknown (${shortAddress(address)})`;
}

function renderMarkdown({
  space,
  start,
  end,
  ledger,
  peopleByAddress,
  warnings,
  stats,
}: {
  space: SpaceInfo;
  start: Date;
  end: Date;
  ledger: Map<string, AddressScore>;
  peopleByAddress: Map<string, PersonRow>;
  warnings: string[];
  stats: Record<string, number>;
}) {
  const rows = [...ledger.entries()]
    .map(([address, score]) => ({
      address,
      score,
      total:
        score.votePts + score.joinPts + score.proposalPts + score.acceptedPts,
    }))
    .sort((a, b) => b.total - a.total || a.address.localeCompare(b.address));

  const lines = [
    `# ${space.title} — competition leaderboard`,
    '',
    `[Space overview](https://app.hypha.earth/en/dho/${space.slug}/overview) · web3 space id \`${space.web3SpaceId}\``,
    `Window: ${start.toISOString()} → ${end.toISOString()} (UTC, end exclusive)`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scoring rules',
    '',
    '| Action | Points |',
    '| --- | ---: |',
    '| Vote on a proposal | 1 |',
    '| Join as a new member | 3 |',
    '| Create a proposal | 2 |',
    '| Proposal accepted (bonus) | +3 |',
    '',
    '## Summary',
    '',
    `- Participants scored: ${rows.length}`,
    `- Vote events counted: ${stats.votes}`,
    `- Member joins counted: ${stats.joins}`,
    `- Proposals created: ${stats.proposals}`,
    `- Proposals accepted: ${stats.accepted}`,
    '',
    '## Leaderboard',
    '',
    '| Rank | Person | Votes | Joins | Proposals | Accepted | Total |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: |',
  ];

  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${formatPersonLabel(row.address, peopleByAddress)} | ${
        row.score.votePts
      } | ${row.score.joinPts} | ${row.score.proposalPts} | ${
        row.score.acceptedPts
      } | **${row.total}** |`,
    );
  });

  if (warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', '## Audit trail', '');

  for (const row of rows) {
    const person = peopleByAddress.get(normalizeAddress(row.address));
    const profileLink = person?.slug
      ? `[profile](${PROFILE_BASE}/${person.slug})`
      : `\`${row.address}\``;

    lines.push(
      `### ${formatPersonLabel(
        row.address,
        peopleByAddress,
      )} (${profileLink}) — ${row.total} pts`,
      '',
    );

    const sortedItems = [...row.score.lineItems].sort(
      (a, b) => a.timestampMs - b.timestampMs,
    );

    for (const item of sortedItems) {
      lines.push(
        `- **+${item.points}** (${item.type}) ${
          item.detail
        } · ${formatTimestamp(item.timestampMs)} · [tx](${BASESCAN_TX}/${
          item.txHash
        })`,
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}

function renderCsv(
  ledger: Map<string, AddressScore>,
  peopleByAddress: Map<string, PersonRow>,
) {
  const rows = [...ledger.entries()]
    .map(([address, score]) => ({
      address,
      score,
      total:
        score.votePts + score.joinPts + score.proposalPts + score.acceptedPts,
    }))
    .sort((a, b) => b.total - a.total || a.address.localeCompare(b.address));

  const lines = [
    'rank,person_slug,name,address,vote_pts,join_pts,proposal_pts,accepted_pts,total',
  ];

  rows.forEach((row, index) => {
    const person = peopleByAddress.get(normalizeAddress(row.address));
    const name = person ? formatPersonName(person) : 'Unknown';
    const slug = person?.slug ?? '';
    lines.push(
      [
        index + 1,
        csvEscape(slug),
        csvEscape(name),
        row.address,
        row.score.votePts,
        row.score.joinPts,
        row.score.proposalPts,
        row.score.acceptedPts,
        row.total,
      ].join(','),
    );
  });

  return lines.join('\n');
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main() {
  const cli = parseCliArgs();
  const hasRpcUrl = Boolean(process.env.RPC_URL?.trim());
  const logsClient = getRpcClient({ forLogs: true });
  const callClient = getRpcClient();
  const useAlchemyForLogs = !hasRpcUrl;
  const space = await loadSpace(cli.spaceSlug);
  const web3SpaceId = BigInt(space.web3SpaceId);

  const daoProposalsAddress =
    daoProposalsImplementationAddress[8453] as `0x${string}`;
  const daoSpaceFactoryAddress =
    daoSpaceFactoryImplementationAddress[8453] as `0x${string}`;

  console.log(
    `Scoring ${space.title} (${space.slug}) web3SpaceId=${space.web3SpaceId}`,
  );
  console.log(`Window: ${cli.start.toISOString()} → ${cli.end.toISOString()}`);

  const latestBlock = await callClient.getBlockNumber();
  const fromBlock =
    cli.fromBlock ??
    (await findBlockByTimestamp(
      callClient,
      Math.floor(cli.start.getTime() / 1000),
      'start',
    ));
  const toBlock = await findBlockByTimestamp(
    callClient,
    Math.floor(cli.end.getTime() / 1000),
    'end',
  );

  console.log(`Block range: ${fromBlock} → ${toBlock} (latest ${latestBlock})`);

  const ledger = new Map<string, AddressScore>();
  const warnings: string[] = [];
  const stats = { votes: 0, joins: 0, proposals: 0, accepted: 0 };

  const belicaProposalIds = await loadDbProposalIds(space.id);
  const creatorByProposalId = await loadDbProposalCreators(space.id);
  const apiCreators = await loadProposalCreatorsFromApi(space.slug);
  for (const [proposalId, creator] of apiCreators) {
    belicaProposalIds.add(proposalId);
    if (!creatorByProposalId.has(proposalId)) {
      creatorByProposalId.set(proposalId, creator);
    }
  }

  const txFromCache = new Map<string, `0x${string}`>();

  const proposalCreatedLogs = await fetchLogsInChunks({
    client: logsClient,
    address: daoProposalsAddress,
    event: PROPOSAL_CREATED_EVENT,
    fromBlock,
    toBlock,
    args: { spaceId: web3SpaceId },
    useAlchemyForLogs,
  });

  const memberJoinedLogs = await fetchLogsInChunks({
    client: logsClient,
    address: daoSpaceFactoryAddress,
    event: MEMBER_JOINED_EVENT,
    fromBlock,
    toBlock,
    args: { spaceId: web3SpaceId },
    useAlchemyForLogs,
  });

  const proposalExecutedLogs = await fetchLogsInChunks({
    client: logsClient,
    address: daoProposalsAddress,
    event: PROPOSAL_EXECUTED_EVENT,
    fromBlock,
    toBlock,
    useAlchemyForLogs,
  });

  for (const log of proposalCreatedLogs) {
    if (log.args.proposalId != null) {
      belicaProposalIds.add(log.args.proposalId.toString());
    }
  }

  const allVoteCastLogs = await fetchLogsInChunks({
    client: logsClient,
    address: daoProposalsAddress,
    event: VOTE_CAST_EVENT,
    fromBlock,
    toBlock,
    useAlchemyForLogs,
  });

  const voteProposalIds = [
    ...new Set(
      allVoteCastLogs
        .map((log) => log.args.proposalId)
        .filter((id): id is bigint => id != null),
    ),
  ];
  const voteProposalCoreById = await loadProposalCores(
    callClient,
    voteProposalIds,
  );

  for (const [id, core] of voteProposalCoreById) {
    if (core.spaceId === web3SpaceId) {
      belicaProposalIds.add(id);
      if (!creatorByProposalId.has(id)) {
        creatorByProposalId.set(id, core.creator);
      }
    }
  }

  const voteCastLogs = allVoteCastLogs.filter((log) => {
    const proposalId = log.args.proposalId;
    return proposalId != null && belicaProposalIds.has(proposalId.toString());
  });

  console.log(
    `VoteCast in window: ${allVoteCastLogs.length} total, ${voteCastLogs.length} for Belica`,
  );

  const blockNumbers = [
    ...proposalCreatedLogs.map((log) => log.blockNumber),
    ...memberJoinedLogs.map((log) => log.blockNumber),
    ...voteCastLogs.map((log) => log.blockNumber),
    ...proposalExecutedLogs.map((log) => log.blockNumber),
  ];
  const blockTimestamps = await loadBlockTimestamps(callClient, blockNumbers);

  for (const log of proposalCreatedLogs) {
    const proposalId = log.args.proposalId;
    if (proposalId == null) continue;

    const creator = await resolveProposalActor(
      callClient,
      log.transactionHash,
      proposalId.toString(),
      log.args.creator,
      creatorByProposalId,
      txFromCache,
    );
    if (!creator) {
      warnings.push(
        `Could not resolve creator for proposal #${proposalId} created on-chain`,
      );
      continue;
    }

    belicaProposalIds.add(proposalId.toString());

    const timestampMs = blockTimestamps.get(log.blockNumber) ?? 0;
    if (!isWithinWindow(timestampMs, cli.start, cli.end)) continue;

    addPoints(ledger, creator, 'proposal', POINTS.proposal, {
      timestampMs,
      txHash: log.transactionHash,
      detail: `Created proposal #${proposalId}`,
    });
    stats.proposals += 1;
  }

  for (const log of memberJoinedLogs) {
    const memberAddress = log.args.memberAddress;
    if (!memberAddress) continue;

    const timestampMs = blockTimestamps.get(log.blockNumber) ?? 0;
    if (!isWithinWindow(timestampMs, cli.start, cli.end)) continue;

    addPoints(ledger, memberAddress, 'join', POINTS.join, {
      timestampMs,
      txHash: log.transactionHash,
      detail: 'Joined space',
    });
    stats.joins += 1;
  }

  const voteDedupe = new Set<string>();
  const unknownExecutedProposalIds = proposalExecutedLogs
    .map((log) => log.args.proposalId)
    .filter(
      (id): id is bigint => id != null && !belicaProposalIds.has(id.toString()),
    );

  const proposalCoreById = await loadProposalCores(callClient, [
    ...new Set(unknownExecutedProposalIds),
  ]);

  const belicaProposalIdSet = new Set(belicaProposalIds);
  for (const [id, core] of proposalCoreById) {
    if (core.spaceId === web3SpaceId) {
      belicaProposalIdSet.add(id);
    }
  }

  for (const log of voteCastLogs) {
    const proposalId = log.args.proposalId;
    const voter = log.args.voter;
    if (proposalId == null || !voter) continue;

    const proposalKey = proposalId.toString();
    const dedupeKey = `${normalizeAddress(voter)}:${proposalKey}`;
    if (voteDedupe.has(dedupeKey)) continue;
    voteDedupe.add(dedupeKey);

    const timestampMs = blockTimestamps.get(log.blockNumber) ?? 0;
    if (!isWithinWindow(timestampMs, cli.start, cli.end)) continue;

    addPoints(ledger, voter, 'vote', POINTS.vote, {
      timestampMs,
      txHash: log.transactionHash,
      detail: `Voted on proposal #${proposalId}`,
    });
    stats.votes += 1;
  }

  for (const log of proposalCreatedLogs) {
    if (log.args.proposalId != null && log.args.creator) {
      creatorByProposalId.set(log.args.proposalId.toString(), log.args.creator);
    }
  }

  for (const [id, core] of proposalCoreById) {
    if (core.spaceId === web3SpaceId) {
      creatorByProposalId.set(id, core.creator);
    }
  }

  for (const log of proposalExecutedLogs) {
    const proposalId = log.args.proposalId;
    const passed = log.args.passed;
    if (proposalId == null || !passed) continue;

    const proposalKey = proposalId.toString();
    if (!belicaProposalIdSet.has(proposalKey)) continue;

    const timestampMs = blockTimestamps.get(log.blockNumber) ?? 0;
    if (!isWithinWindow(timestampMs, cli.start, cli.end)) continue;

    const creator = await resolveProposalActor(
      callClient,
      log.transactionHash,
      proposalKey,
      creatorByProposalId.get(proposalKey) ??
        proposalCoreById.get(proposalKey)?.creator,
      creatorByProposalId,
      txFromCache,
    );

    if (!creator) {
      warnings.push(
        `Could not resolve creator for accepted proposal #${proposalId}`,
      );
      continue;
    }

    addPoints(ledger, creator, 'accepted', POINTS.accepted, {
      timestampMs,
      txHash: log.transactionHash,
      detail: `Proposal #${proposalId} accepted`,
    });
    stats.accepted += 1;
  }

  const dbJoinEvents = await loadDbJoinEvents(space.id, cli.start, cli.end);
  const onChainJoinAddresses = new Set(
    memberJoinedLogs
      .map((log) => log.args.memberAddress)
      .filter((address): address is `0x${string}` => Boolean(address))
      .map(normalizeAddress),
  );

  for (const dbJoin of dbJoinEvents) {
    const key = normalizeAddress(dbJoin.memberAddress);
    if (!onChainJoinAddresses.has(key)) {
      warnings.push(
        `DB joinSpace event #${dbJoin.id} for ${shortAddress(
          dbJoin.memberAddress,
        )} at ${dbJoin.createdAt.toISOString()} has no matching on-chain MemberJoined log`,
      );
    }
  }

  const addresses = [...ledger.keys()];
  const peopleByAddress = await loadPeopleByAddress(addresses);

  const markdown = renderMarkdown({
    space,
    start: cli.start,
    end: cli.end,
    ledger,
    peopleByAddress,
    warnings,
    stats,
  });
  const csv = renderCsv(ledger, peopleByAddress);

  mkdirSync(resolve(cli.outputMd, '..'), { recursive: true });
  writeFileSync(cli.outputMd, markdown, 'utf8');
  writeFileSync(cli.outputCsv, csv, 'utf8');

  console.log(`\nMarkdown report: ${cli.outputMd}`);
  console.log(`CSV report: ${cli.outputCsv}`);
  console.log(
    JSON.stringify(
      {
        space: space.title,
        participants: ledger.size,
        stats,
        warnings: warnings.length,
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
