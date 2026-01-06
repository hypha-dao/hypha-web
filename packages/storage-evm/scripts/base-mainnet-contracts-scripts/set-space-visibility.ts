import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Visibility levels
const DISCOVERABILITY = {
  PUBLIC: 0,
  NETWORK: 1,
  ORG: 2,
  SPACE: 3,
} as const;

const ACCESS = {
  PUBLIC: 0,
  NETWORK: 1,
  ORG: 2,
  SPACE: 3,
} as const;

// Configuration per space category
const SPACE_CONFIG = {
  Sandbox: {
    discoverability: DISCOVERABILITY.SPACE, // 3
    access: ACCESS.ORG, // 2
  },
  Pilot: {
    discoverability: DISCOVERABILITY.NETWORK, // 1
    access: ACCESS.ORG, // 2
  },
  Live: {
    discoverability: DISCOVERABILITY.PUBLIC, // 0
    access: ACCESS.ORG, // 2
  },
} as const;

type SpaceCategory = keyof typeof SPACE_CONFIG;

interface SpaceIdsJson {
  Sandbox: number[];
  Pilot: number[];
  Live: number[];
}

function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  const patterns = {
    DAOSpaceFactory: /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
  } as const;

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

function loadSpaceIds(): SpaceIdsJson {
  const spacesPath = path.resolve(__dirname, './spaces-ids.json');
  const fileContent = fs.readFileSync(spacesPath, 'utf8');
  return JSON.parse(fileContent) as SpaceIdsJson;
}

const daoSpaceFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'uint256', name: '_access', type: 'uint256' },
    ],
    name: 'setSpaceAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'uint256', name: '_discoverability', type: 'uint256' },
    ],
    name: 'setSpaceDiscoverability',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceVisibility',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'discoverability', type: 'uint256' },
          { internalType: 'uint256', name: 'access', type: 'uint256' },
        ],
        internalType: 'struct IDAOSpaceFactory.SpaceVisibility',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function usage(): void {
  console.log(
    'Usage: npx tsx set-space-visibility.ts [--dry-run] [--category <Sandbox|Pilot|Live>] [--batch-size <number>] [--skip-unchanged]',
  );
  console.log('');
  console.log('Options:');
  console.log('  --dry-run              Simulate without sending transactions');
  console.log(
    '  --category <name>      Process only specific category (Sandbox, Pilot, or Live)',
  );
  console.log(
    '  --batch-size <number>  Number of spaces to process per batch (default: 10)',
  );
  console.log(
    '  --skip-unchanged       Skip spaces that already have the target values (default: always set)',
  );
  console.log('');
  console.log('Configuration:');
  console.log('  Sandbox: discoverability=3 (Space), access=2 (Org)');
  console.log('  Pilot:   discoverability=1 (Network), access=2 (Org)');
  console.log('  Live:    discoverability=0 (Public), access=2 (Org)');
}

function getDiscoverabilityName(value: number): string {
  const names: Record<number, string> = {
    0: 'Public',
    1: 'Network',
    2: 'Org',
    3: 'Space',
  };
  return names[value] ?? `Unknown(${value})`;
}

function getAccessName(value: number): string {
  const names: Record<number, string> = {
    0: 'Public',
    1: 'Network',
    2: 'Org',
    3: 'Space',
  };
  return names[value] ?? `Unknown(${value})`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const skipUnchanged = args.includes('--skip-unchanged');
  const categoryIndex = args.indexOf('--category');
  const batchSizeIndex = args.indexOf('--batch-size');

  const categoryFilter =
    categoryIndex !== -1 ? (args[categoryIndex + 1] as SpaceCategory) : null;
  const batchSize =
    batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1], 10) : 10;

  if (categoryFilter && !['Sandbox', 'Pilot', 'Live'].includes(categoryFilter)) {
    console.error(
      `Invalid category: ${categoryFilter}. Must be Sandbox, Pilot, or Live.`,
    );
    process.exit(1);
  }

  // Load configuration
  const addresses = parseAddressesFile();
  const daoSpaceFactoryAddress = addresses['DAOSpaceFactory'];

  if (!daoSpaceFactoryAddress) {
    throw new Error(
      'DAOSpaceFactory address not found in contracts/addresses.txt',
    );
  }

  const spaceIds = loadSpaceIds();

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  );

  // Check ownership
  const contractOwner = await daoSpaceFactory.owner();
  const isOwner = wallet.address.toLowerCase() === contractOwner.toLowerCase();

  console.log('='.repeat(60));
  console.log('Space Visibility Configuration Script');
  console.log('='.repeat(60));
  console.log(`DAOSpaceFactory: ${daoSpaceFactoryAddress}`);
  console.log(`Caller: ${wallet.address}`);
  console.log(`Contract Owner: ${contractOwner}`);
  console.log(`Is Owner: ${isOwner}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Skip Unchanged: ${skipUnchanged}`);
  if (categoryFilter) {
    console.log(`Category Filter: ${categoryFilter}`);
  }
  console.log('='.repeat(60));

  if (!isOwner) {
    console.warn(
      '⚠️  Warning: Caller is not the contract owner. Transactions may revert unless caller is a space executor.',
    );
  }

  // Determine which categories to process
  const categoriesToProcess: SpaceCategory[] = categoryFilter
    ? [categoryFilter]
    : (['Sandbox', 'Pilot', 'Live'] as SpaceCategory[]);

  // Summary statistics
  const summary = {
    total: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { spaceId: number; error: string }[],
  };

  for (const category of categoriesToProcess) {
    const ids = spaceIds[category];
    const config = SPACE_CONFIG[category];

    console.log('');
    console.log(`📁 Processing ${category} spaces (${ids.length} total)`);
    console.log(
      `   Target: discoverability=${config.discoverability} (${getDiscoverabilityName(config.discoverability)}), access=${config.access} (${getAccessName(config.access)})`,
    );
    console.log('-'.repeat(60));

    summary.total += ids.length;

    // Process in batches
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      console.log(
        `\n   Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)}: spaces ${batch[0]} to ${batch[batch.length - 1]}`,
      );

      for (const spaceId of batch) {
        try {
          // Check current visibility
          let currentVisibility: { discoverability: bigint; access: bigint };
          try {
            currentVisibility = await daoSpaceFactory.getSpaceVisibility(spaceId);
          } catch {
            console.log(
              `   ⚠️  Space ${spaceId}: Could not fetch current visibility, skipping...`,
            );
            summary.skipped++;
            continue;
          }

          const currentDiscoverability = Number(currentVisibility.discoverability);
          const currentAccess = Number(currentVisibility.access);

          const discoverabilityMatches =
            currentDiscoverability === config.discoverability;
          const accessMatches = currentAccess === config.access;

          // Only skip if --skip-unchanged is set AND both values already match
          if (skipUnchanged && discoverabilityMatches && accessMatches) {
            console.log(
              `   ✓ Space ${spaceId}: Already configured correctly (d=${currentDiscoverability}, a=${currentAccess})`,
            );
            summary.skipped++;
            continue;
          }

          if (dryRun) {
            console.log(
              `   🔍 Space ${spaceId}: Would set: discoverability=${config.discoverability} (${getDiscoverabilityName(config.discoverability)}), access=${config.access} (${getAccessName(config.access)})` +
                ` [current: d=${currentDiscoverability}, a=${currentAccess}]`,
            );
            summary.processed++;
            continue;
          }

          // Always set both values (unless --skip-unchanged is used)
          console.log(
            `   📝 Space ${spaceId}: Setting discoverability=${config.discoverability}, access=${config.access}...`,
          );

          const tx1 = await daoSpaceFactory.setSpaceDiscoverability(
            spaceId,
            config.discoverability,
          );
          await tx1.wait();

          const tx2 = await daoSpaceFactory.setSpaceAccess(
            spaceId,
            config.access,
          );
          await tx2.wait();

          console.log(`   ✅ Space ${spaceId}: Updated successfully`);
          summary.processed++;
        } catch (error: any) {
          const errorMsg = error?.shortMessage || error?.message || String(error);
          console.error(`   ❌ Space ${spaceId}: Failed - ${errorMsg}`);
          summary.failed++;
          summary.errors.push({ spaceId, error: errorMsg });
        }
      }
    }
  }

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total spaces: ${summary.total}`);
  console.log(`Processed: ${summary.processed}`);
  console.log(`Skipped (already correct): ${summary.skipped}`);
  console.log(`Failed: ${summary.failed}`);

  if (summary.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const err of summary.errors) {
      console.log(`  - Space ${err.spaceId}: ${err.error}`);
    }
  }

  if (dryRun) {
    console.log('');
    console.log('🔍 This was a dry run. No transactions were sent.');
    console.log('   Remove --dry-run to execute the changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

