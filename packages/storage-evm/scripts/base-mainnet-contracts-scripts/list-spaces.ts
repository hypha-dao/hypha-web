import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface SpaceDetails {
  unity: bigint;
  quorum: bigint;
  votingPowerSource: bigint;
  tokenAddresses: string[];
  members: string[];
  exitMethod: bigint;
  joinMethod: bigint;
  createdAt: bigint;
  creator: string;
  executor: string;
}

interface ParsedArgs {
  startId?: number;
  endId?: number;
  latest?: number;
}

interface DAOSpaceFactoryInterface {
  getSpaceDetails: (spaceId: number) => Promise<SpaceDetails>;
  spaceCounter: () => Promise<bigint>;
}

const daoSpaceFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
    ],
    name: 'getSpaceDetails',
    outputs: [
      {
        internalType: 'uint256',
        name: 'unity',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'quorum',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'votingPowerSource',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: 'tokenAddresses',
        type: 'address[]',
      },
      {
        internalType: 'address[]',
        name: 'members',
        type: 'address[]',
      },
      {
        internalType: 'uint256',
        name: 'exitMethod',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'joinMethod',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'createdAt',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'executor',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
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

function parseArguments(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {};

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
    } else if (arg === '--latest' && i + 1 < args.length) {
      result.latest = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx list-spaces.ts [options]

Options:
  --start, --from <number>    Start space ID (default: 1)
  --end, --to <number>        End space ID (default: spaceCounter)
  --range <start,end>         Range of space IDs (e.g., --range 1,10)
  --latest <number>           List the latest N spaces in descending order
  --help, -h                  Show this help message

Examples:
  npx tsx list-spaces.ts                    # List all spaces
  npx tsx list-spaces.ts --start 10 --end 20   # List spaces 10-20
  npx tsx list-spaces.ts --range 100,115       # List spaces 100-115
  npx tsx list-spaces.ts --from 116            # List spaces from 116 to end
  npx tsx list-spaces.ts --latest 10           # List the 10 most recent spaces
      `);
      process.exit(0);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const { startId, endId, latest } = parseArguments();

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Get the contract instance
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS || '',
    daoSpaceFactoryAbi,
    provider,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  try {
    // Get total number of spaces
    const spaceCounter = await daoSpaceFactory.spaceCounter();
    console.log(`Total number of spaces (counter): ${spaceCounter}`);

    // Determine the actual range to query
    let actualStartId: number;
    let actualEndId: number;

    if (latest) {
      actualEndId = Number(spaceCounter);
      actualStartId = Math.max(1, actualEndId - latest + 1);
    } else {
      actualStartId = startId || 1;
      actualEndId = endId || Number(spaceCounter);
    }

    // Validate range
    if (actualStartId < 1) {
      throw new Error('Start ID must be at least 1');
    }
    if (actualEndId < actualStartId) {
      throw new Error('End ID must be greater than or equal to start ID');
    }

    console.log(`Querying spaces ${actualStartId} to ${actualEndId}\n`);

    let validSpaces = 0;
    let invalidSpaces = 0;
    const failedSpaceIds: number[] = [];

    const spaceIdsToQuery: number[] = [];
    if (latest) {
      for (let i = actualEndId; i >= actualStartId; i--) {
        spaceIdsToQuery.push(i);
      }
    } else {
      for (let i = actualStartId; i <= actualEndId; i++) {
        spaceIdsToQuery.push(i);
      }
    }
    // Iterate through the specified range of spaces
    for (const spaceId of spaceIdsToQuery) {
      try {
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);

        // Check if this is a valid space (has a creator address)
        if (spaceDetails.creator === ethers.ZeroAddress) {
          console.log(`Space ${spaceId}: Invalid (zero creator address)`);
          invalidSpaces++;
          failedSpaceIds.push(spaceId);
          continue;
        }

        validSpaces++;

        // Format timestamp to human readable date
        const createdDate = new Date(
          Number(spaceDetails.createdAt) * 1000,
        ).toLocaleString();

        console.log(`\n=== Space ${spaceId} ===`);
        console.log('Unity:', Number(spaceDetails.unity), '%');
        console.log('Quorum:', Number(spaceDetails.quorum), '%');
        console.log(
          'Voting Power Source:',
          Number(spaceDetails.votingPowerSource),
        );
        console.log('Token Addresses:', spaceDetails.tokenAddresses);
        console.log('Members:', spaceDetails.members);
        console.log('Exit Method:', Number(spaceDetails.exitMethod));
        console.log('Join Method:', Number(spaceDetails.joinMethod));
        console.log('Created At:', createdDate);
        console.log('Creator:', spaceDetails.creator);
        console.log('Executor:', spaceDetails.executor);
        console.log('Number of Members:', spaceDetails.members.length);
        console.log('===============\n');
      } catch (error: any) {
        invalidSpaces++;
        failedSpaceIds.push(spaceId);

        // Check if it's a CALL_EXCEPTION (space doesn't exist)
        if (error.code === 'CALL_EXCEPTION') {
          console.log(`Space ${spaceId}: Does not exist (CALL_EXCEPTION)`);
        } else {
          console.error(
            `Space ${spaceId}: Unexpected error - ${error.message}`,
          );
        }
      }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Range queried: ${actualStartId} to ${actualEndId}`);
    console.log(`Valid spaces: ${validSpaces}`);
    console.log(`Invalid/missing spaces: ${invalidSpaces}`);
    console.log(`Total spaces in contract: ${spaceCounter}`);

    if (failedSpaceIds.length > 0) {
      console.log(`\nFailed space IDs: ${failedSpaceIds.join(', ')}`);

      // Identify patterns in failed spaces
      if (failedSpaceIds.length > 1) {
        const firstFailed = failedSpaceIds[0];
        const lastFailed = failedSpaceIds[failedSpaceIds.length - 1];
        const isConsecutive = failedSpaceIds.every(
          (id, index) => index === 0 || id === failedSpaceIds[index - 1] + 1,
        );

        if (isConsecutive && failedSpaceIds.length > 1) {
          console.log(
            `Pattern: Consecutive failures from ${firstFailed} to ${lastFailed}`,
          );
          if (firstFailed > 1) {
            console.log(
              'This suggests space creation stopped working after space',
              firstFailed - 1,
            );
          }
        }
      }
    }
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
