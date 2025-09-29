import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface SpacePaymentInfo {
  expiryTime: bigint;
  freeTrialUsed: boolean;
}

interface SpacePaymentTrackerInterface {
  hasUsedFreeTrial: (spaceId: number) => Promise<boolean>;
  getSpaceExpiryTime: (spaceId: number) => Promise<bigint>;
  isSpaceActive: (spaceId: number) => Promise<boolean>;
  extendFreeTrial: (spaceId: number, durationInDays: number) => Promise<any>;
}

interface DAOSpaceFactoryInterface {
  spaceCounter: () => Promise<bigint>;
}

const spacePaymentTrackerAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
    ],
    name: 'hasUsedFreeTrial',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
    ],
    name: 'getSpaceExpiryTime',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
    ],
    name: 'isSpaceActive',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'durationInDays',
        type: 'uint256',
      },
    ],
    name: 'extendFreeTrial',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const daoSpaceFactoryAbi = [
  {
    inputs: [],
    name: 'spaceCounter',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

function parseArguments(): {
  startId?: number;
  endId?: number;
  extensionDays?: number;
  dryRun?: boolean;
} {
  const args = process.argv.slice(2);
  const result: {
    startId?: number;
    endId?: number;
    extensionDays?: number;
    dryRun?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '--start' || arg === '--from') && i + 1 < args.length) {
      result.startId = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if ((arg === '--end' || arg === '--to') && i + 1 < args.length) {
      result.endId = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if (arg === '--range' && i + 1 < args.length) {
      const range = args[i + 1].split(',');
      if (range.length === 2) {
        result.startId = parseInt(range[0], 10);
        result.endId = parseInt(range[1], 10);
      }
      i++; // Skip the next argument as it's the value
    } else if (arg === '--days' && i + 1 < args.length) {
      result.extensionDays = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx extend-free-trials.ts [options]

Options:
  --start, --from <number>    Start space ID (default: 1)
  --end, --to <number>        End space ID (default: spaceCounter)
  --range <start,end>         Range of space IDs (e.g., --range 1,10)
  --days <number>             Number of days to extend (default: 30)
  --dry-run                   Only check and report, don't execute extensions
  --help, -h                  Show this help message

Examples:
  npx tsx extend-free-trials.ts                           # Check all spaces, extend by 30 days
  npx tsx extend-free-trials.ts --dry-run                 # Check all spaces without extending
  npx tsx extend-free-trials.ts --start 10 --end 20      # Check spaces 10-20
  npx tsx extend-free-trials.ts --range 100,115 --days 60 # Check spaces 100-115, extend by 60 days
  npx tsx extend-free-trials.ts --from 116 --dry-run     # Check spaces from 116 to end (dry run)
      `);
      process.exit(0);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const {
    startId,
    endId,
    extensionDays = 30,
    dryRun = false,
  } = parseArguments();

  // Validate environment variables
  if (!process.env.RPC_URL) {
    throw new Error('RPC_URL environment variable is required');
  }

  // Set default addresses if not provided in environment
  const DAO_SPACE_FACTORY_ADDRESS =
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
    '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
  const SPACE_PAYMENT_TRACKER_ADDRESS =
    process.env.SPACE_PAYMENT_TRACKER_ADDRESS ||
    '0x4B61250c8F19BA96C473c65022453E95176b0139';
  if (!dryRun && !process.env.PRIVATE_KEY) {
    throw new Error(
      'PRIVATE_KEY environment variable is required for executing transactions',
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  let signer: ethers.Signer | ethers.Provider;

  if (dryRun) {
    signer = provider; // Use provider for read-only operations
  } else {
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    signer = wallet;
    console.log(`Using wallet address: ${wallet.address}`);
  }

  // Get contract instances
  const daoSpaceFactory = new ethers.Contract(
    DAO_SPACE_FACTORY_ADDRESS,
    daoSpaceFactoryAbi,
    provider,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  const spacePaymentTracker = new ethers.Contract(
    SPACE_PAYMENT_TRACKER_ADDRESS,
    spacePaymentTrackerAbi,
    signer,
  ) as ethers.Contract & SpacePaymentTrackerInterface;

  try {
    // Get total number of spaces
    const spaceCounter = await daoSpaceFactory.spaceCounter();
    console.log(`Total number of spaces (counter): ${spaceCounter}`);

    // Determine the actual range to query
    const actualStartId = startId || 1;
    const actualEndId = endId || Number(spaceCounter);

    // Validate range
    if (actualStartId < 1) {
      throw new Error('Start ID must be at least 1');
    }
    if (actualEndId < actualStartId) {
      throw new Error('End ID must be greater than or equal to start ID');
    }

    console.log(`\nChecking spaces ${actualStartId} to ${actualEndId}`);
    console.log(`Extension duration: ${extensionDays} days`);
    console.log(
      `Mode: ${dryRun ? 'DRY RUN (no transactions)' : 'EXECUTE EXTENSIONS'}`,
    );
    console.log('='.repeat(50));

    let spacesChecked = 0;
    let spacesWithFreeTrial = 0;
    let spacesToExtend: number[] = [];
    let extendedSpaces = 0;
    let failedExtensions: { spaceId: number; error: string }[] = [];

    // Iterate through the specified range of spaces
    for (let spaceId = actualStartId; spaceId <= actualEndId; spaceId++) {
      try {
        spacesChecked++;

        // Check if space has used free trial
        const hasUsedFreeTrial = await spacePaymentTracker.hasUsedFreeTrial(
          spaceId,
        );

        if (hasUsedFreeTrial) {
          spacesWithFreeTrial++;

          // Get current expiry time and active status
          const expiryTime = await spacePaymentTracker.getSpaceExpiryTime(
            spaceId,
          );
          const isActive = await spacePaymentTracker.isSpaceActive(spaceId);
          const expiryDate = new Date(Number(expiryTime) * 1000);

          console.log(`\nSpace ${spaceId}:`);
          console.log(`  Has used free trial: ✓`);
          console.log(`  Current expiry: ${expiryDate.toLocaleString()}`);
          console.log(`  Currently active: ${isActive ? '✓' : '✗'}`);

          spacesToExtend.push(spaceId);

          if (!dryRun) {
            try {
              console.log(`  Extending by ${extensionDays} days...`);
              const tx = await spacePaymentTracker.extendFreeTrial(
                spaceId,
                extensionDays,
              );
              await tx.wait();

              // Get updated expiry time
              const newExpiryTime =
                await spacePaymentTracker.getSpaceExpiryTime(spaceId);
              const newExpiryDate = new Date(Number(newExpiryTime) * 1000);

              console.log(
                `  ✓ Extended! New expiry: ${newExpiryDate.toLocaleString()}`,
              );
              console.log(`  Transaction hash: ${tx.hash}`);
              extendedSpaces++;
            } catch (error: any) {
              console.log(`  ✗ Failed to extend: ${error.message}`);
              failedExtensions.push({ spaceId, error: error.message });
            }
          } else {
            console.log(`  Would extend by ${extensionDays} days (DRY RUN)`);
          }
        } else {
          // Only log if we want verbose output
          if (spacesChecked % 100 === 0) {
            console.log(`Checked ${spacesChecked} spaces...`);
          }
        }
      } catch (error: any) {
        console.error(`Error checking space ${spaceId}: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('=== SUMMARY ===');
    console.log(`Range checked: ${actualStartId} to ${actualEndId}`);
    console.log(`Total spaces checked: ${spacesChecked}`);
    console.log(`Spaces with free trial used: ${spacesWithFreeTrial}`);
    console.log(`Spaces identified for extension: ${spacesToExtend.length}`);

    if (!dryRun) {
      console.log(`Successfully extended: ${extendedSpaces}`);
      console.log(`Failed extensions: ${failedExtensions.length}`);

      if (failedExtensions.length > 0) {
        console.log('\nFailed extensions:');
        failedExtensions.forEach(({ spaceId, error }) => {
          console.log(`  Space ${spaceId}: ${error}`);
        });
      }
    } else {
      console.log('\nSpaces that would be extended:');
      if (spacesToExtend.length > 0) {
        console.log(spacesToExtend.join(', '));
      } else {
        console.log('None');
      }
    }

    console.log('\n✓ Script completed successfully');
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
