import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

interface ParsedArgs {
  fromBlock?: number;
  toBlock?: number;
  range?: [number, number];
  chunkSize?: number;
  contract?: string;
  help?: boolean;
}

function parseArguments(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '--from' || arg === '--fromBlock') && i + 1 < args.length) {
      parsed.fromBlock = parseInt(args[++i], 10);
    } else if ((arg === '--to' || arg === '--toBlock') && i + 1 < args.length) {
      const val = args[++i];
      parsed.toBlock = val.toLowerCase() === 'latest' ? -1 : parseInt(val, 10);
    } else if (arg === '--range' && i + 1 < args.length) {
      const range = args[++i].split(',');
      if (range.length === 2) {
        parsed.fromBlock = parseInt(range[0], 10);
        const end = range[1];
        parsed.toBlock =
          end.toLowerCase() === 'latest' ? -1 : parseInt(end, 10);
      }
    } else if (
      (arg === '--chunk' || arg === '--chunkSize') &&
      i + 1 < args.length
    ) {
      parsed.chunkSize = parseInt(args[++i], 10);
    } else if (
      (arg === '--address' || arg === '--contract') &&
      i + 1 < args.length
    ) {
      parsed.contract = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

function showHelp(): void {
  console.log(`
Usage: npx tsx list-mint-transfer-whitelist.ts [options]

Options:
  --from, --fromBlock <block>   Start block (default: 0)
  --to, --toBlock <block|latest> End block (default: latest)
  --range <from,to>             Block range, e.g. --range 12000000,latest
  --chunk, --chunkSize <n>      Block chunk size per query (default: 200000)
  --address, --contract <addr>  Override HyphaToken address (default: from addresses.txt)
  --help, -h                    Show this help

Examples:
  npx tsx list-mint-transfer-whitelist.ts
  npx tsx list-mint-transfer-whitelist.ts --from 12000000 --to latest
  npx tsx list-mint-transfer-whitelist.ts --range 12000000,12500000 --chunk 100000
`);
}

function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  const patterns = {
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
  } as const;

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

// Minimal ABI: just the event and an optional view function for verification
const hyphaTokenAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      { indexed: true, internalType: 'bool', name: 'status', type: 'bool' },
    ],
    name: 'MintTransferWhitelistUpdated',
    type: 'event',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isMintTransferWhitelisted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function main(): Promise<void> {
  const { fromBlock, toBlock, chunkSize, contract, help } = parseArguments();
  if (help) {
    showHelp();
    process.exit(0);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const addresses = parseAddressesFile();
  const hyphaTokenAddress = contract || addresses['HyphaToken'];
  if (!hyphaTokenAddress) {
    throw new Error(
      'HyphaToken address not found. Provide --address or ensure contracts/addresses.txt contains it.',
    );
  }

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    provider,
  );
  const iface = new ethers.Interface(hyphaTokenAbi as any);

  const latestBlock = await provider.getBlockNumber();
  const start = fromBlock ?? 0;
  const end = toBlock === -1 || toBlock === undefined ? latestBlock : toBlock;
  const step = Math.max(1, chunkSize ?? 200_000);

  console.log(
    `Scanning MintTransferWhitelistUpdated events for ${hyphaTokenAddress}`,
  );
  console.log(`Blocks: ${start} to ${end} (chunk size: ${step})`);

  // Map of address -> current status
  const statusByAddress = new Map<string, boolean>();

  // Iterate in chunks to avoid provider limits
  let current = start;
  while (current <= end) {
    const chunkEnd = Math.min(current + step - 1, end);
    try {
      const events = await hyphaToken.queryFilter(
        hyphaToken.filters.MintTransferWhitelistUpdated(),
        current,
        chunkEnd,
      );

      for (const ev of events) {
        let account: string | undefined;
        let status: boolean | undefined;

        // ethers v6: EventLog has args; Log does not. Use type guard + Interface as fallback
        if ('args' in ev && (ev as any).args) {
          const args = (ev as any).args;
          account = (args.account ?? args[0]) as string;
          status = Boolean(args.status ?? args[1]);
        } else {
          try {
            const parsed = iface.parseLog(ev);
            account = parsed.args.account as string;
            status = Boolean(parsed.args.status as boolean);
          } catch (e) {
            // skip un-parseable log
          }
        }

        if (account !== undefined && status !== undefined) {
          statusByAddress.set(account.toLowerCase(), !!status);
        }
      }
    } catch (err: any) {
      console.error(
        `Error querying logs for blocks ${current}-${chunkEnd}: ${
          err.message || err
        }`,
      );
      throw err;
    }

    current = chunkEnd + 1;
  }

  const active = Array.from(statusByAddress.entries())
    .filter(([, status]) => status)
    .map(([addr]) => addr);

  console.log('\n=== Mint Transfer Whitelist (current) ===');
  if (active.length === 0) {
    console.log('No addresses are currently whitelisted.');
  } else {
    for (const addr of active) {
      console.log(addr);
    }
  }

  console.log(`\nTotal unique addresses seen: ${statusByAddress.size}`);
  console.log(`Currently whitelisted: ${active.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
