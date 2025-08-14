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

interface DAOSpaceFactoryInterface {
  getSpaceDetails: (spaceId: number) => Promise<SpaceDetails>;
  spaceCounter: () => Promise<bigint>;
}

interface TokenInterface {
  maxSupply: () => Promise<bigint>;
  name: () => Promise<string>;
  symbol: () => Promise<string>;
  decimals: () => Promise<bigint>;
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

// Minimal ABI for max supply checking
const tokenAbi = [
  {
    inputs: [],
    name: 'maxSupply',
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
    inputs: [],
    name: 'name',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        internalType: 'uint8',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

function parseArguments(): {
  startId?: number;
  endId?: number;
  tokenAddress?: string;
  spaceId?: number;
} {
  const args = process.argv.slice(2);
  const result: {
    startId?: number;
    endId?: number;
    tokenAddress?: string;
    spaceId?: number;
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
    } else if (
      (arg === '--token' || arg === '--address') &&
      i + 1 < args.length
    ) {
      result.tokenAddress = args[i + 1];
      i++; // Skip the next argument as it's the value
    } else if (
      (arg === '--space' || arg === '--space-id') &&
      i + 1 < args.length
    ) {
      result.spaceId = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx check-max-supply.ts [options]

Options:
  --start, --from <number>         Start space ID (default: 1)
  --end, --to <number>             End space ID (default: spaceCounter)
  --range <start,end>              Range of space IDs (e.g., --range 1,10)
  --token, --address <address>     Check specific token address only
  --space, --space-id <number>     Check tokens for specific space ID only
  --help, -h                       Show this help message

Examples:
  npx tsx check-max-supply.ts                           # Check all spaces' tokens
  npx tsx check-max-supply.ts --start 10 --end 20       # Check spaces 10-20
  npx tsx check-max-supply.ts --range 100,115           # Check spaces 100-115
  npx tsx check-max-supply.ts --space 123               # Check tokens for space 123 only
  npx tsx check-max-supply.ts --token 0x1234...         # Check specific token address
      `);
      process.exit(0);
    }
  }

  return result;
}

async function getTokenMaxSupply(
  tokenAddress: string,
  provider: ethers.JsonRpcProvider,
): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: bigint | null;
  isSpaceToken: boolean;
}> {
  const token = new ethers.Contract(
    tokenAddress,
    tokenAbi,
    provider,
  ) as ethers.Contract & TokenInterface;

  // Get basic token info first
  const [name, symbol, decimals] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
  ]);

  // Try to get maxSupply - this might fail for standard ERC20 tokens
  let maxSupply: bigint | null = null;
  let isSpaceToken = false;

  try {
    maxSupply = await token.maxSupply();
    isSpaceToken = true; // If maxSupply exists, it's likely a SpaceToken
  } catch (error: any) {
    // Check if it's specifically a "function doesn't exist" error
    if (
      error.code === 'BAD_DATA' ||
      error.message.includes('could not decode result data')
    ) {
      // This is a standard ERC20 token without maxSupply function
      maxSupply = null;
      isSpaceToken = false;
    } else {
      // Some other error occurred, re-throw it
      throw error;
    }
  }

  return {
    name,
    symbol,
    decimals: Number(decimals),
    maxSupply,
    isSpaceToken,
  };
}

async function main(): Promise<void> {
  const { startId, endId, tokenAddress, spaceId } = parseArguments();

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // If specific token address is provided, check only that token
  if (tokenAddress) {
    console.log(`Checking max supply for token: ${tokenAddress}\n`);

    try {
      const tokenInfo = await getTokenMaxSupply(tokenAddress, provider);

      console.log(`=== Token: ${tokenInfo.name} (${tokenInfo.symbol}) ===`);
      console.log('Address:', tokenAddress);
      console.log(
        'Type:',
        tokenInfo.isSpaceToken ? 'SpaceToken' : 'Standard ERC20',
      );
      console.log('Decimals:', tokenInfo.decimals);
      console.log(
        'Max Supply:',
        tokenInfo.maxSupply === null
          ? 'N/A (Standard ERC20)'
          : tokenInfo.maxSupply === 0n
          ? 'Unlimited'
          : ethers.formatUnits(tokenInfo.maxSupply, tokenInfo.decimals),
      );
      console.log('===============\n');
    } catch (error: any) {
      console.error(`Error checking token ${tokenAddress}:`, error.message);
    }

    return;
  }

  // Get the DAO Space Factory contract instance
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

    if (spaceId !== undefined) {
      // Check specific space only
      actualStartId = spaceId;
      actualEndId = spaceId;
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

    console.log(
      `Checking max supply for spaces ${actualStartId} to ${actualEndId}\n`,
    );

    let validSpaces = 0;
    let invalidSpaces = 0;
    let totalTokensChecked = 0;
    let tokenErrors = 0;
    let spaceTokens = 0;
    let standardTokens = 0;
    const failedSpaceIds: number[] = [];

    // Iterate through the specified range of spaces
    for (
      let currentSpaceId = actualStartId;
      currentSpaceId <= actualEndId;
      currentSpaceId++
    ) {
      try {
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(
          currentSpaceId,
        );

        // Check if this is a valid space (has a creator address)
        if (spaceDetails.creator === ethers.ZeroAddress) {
          console.log(
            `Space ${currentSpaceId}: Invalid (zero creator address)`,
          );
          invalidSpaces++;
          failedSpaceIds.push(currentSpaceId);
          continue;
        }

        validSpaces++;

        console.log(`\n=== Space ${currentSpaceId} ===`);
        console.log('Creator:', spaceDetails.creator);
        console.log('Executor:', spaceDetails.executor);
        console.log('Token Addresses:', spaceDetails.tokenAddresses);
        console.log('Number of Members:', spaceDetails.members.length);

        // Check each token in this space
        if (spaceDetails.tokenAddresses.length === 0) {
          console.log('No tokens associated with this space');
        } else {
          for (const tokenAddr of spaceDetails.tokenAddresses) {
            totalTokensChecked++;
            console.log(`\n--- Token: ${tokenAddr} ---`);

            try {
              const tokenInfo = await getTokenMaxSupply(tokenAddr, provider);

              console.log('Name:', tokenInfo.name);
              console.log('Symbol:', tokenInfo.symbol);
              console.log(
                'Type:',
                tokenInfo.isSpaceToken ? 'SpaceToken' : 'Standard ERC20',
              );
              console.log('Decimals:', tokenInfo.decimals);
              console.log(
                'Max Supply:',
                tokenInfo.maxSupply === null
                  ? 'N/A (Standard ERC20)'
                  : tokenInfo.maxSupply === 0n
                  ? 'Unlimited'
                  : ethers.formatUnits(tokenInfo.maxSupply, tokenInfo.decimals),
              );

              if (tokenInfo.isSpaceToken) {
                spaceTokens++;
              } else {
                standardTokens++;
              }
            } catch (error: any) {
              tokenErrors++;
              console.error(`Error reading token info: ${error.message}`);
            }
          }
        }

        console.log('===============\n');
      } catch (error: any) {
        invalidSpaces++;
        failedSpaceIds.push(currentSpaceId);

        // Check if it's a CALL_EXCEPTION (space doesn't exist)
        if (error.code === 'CALL_EXCEPTION') {
          console.log(
            `Space ${currentSpaceId}: Does not exist (CALL_EXCEPTION)`,
          );
        } else {
          console.error(
            `Space ${currentSpaceId}: Unexpected error - ${error.message}`,
          );
        }
      }
    }

    // Summary
    console.log('\n=== MAX SUPPLY SUMMARY ===');
    console.log(`Range queried: ${actualStartId} to ${actualEndId}`);
    console.log(`Valid spaces: ${validSpaces}`);
    console.log(`Invalid/missing spaces: ${invalidSpaces}`);
    console.log(`Total tokens checked: ${totalTokensChecked}`);
    console.log(`SpaceTokens (with maxSupply): ${spaceTokens}`);
    console.log(`Standard ERC20 tokens: ${standardTokens}`);
    console.log(`Token read errors: ${tokenErrors}`);
    console.log(`Total spaces in contract: ${spaceCounter}`);

    if (failedSpaceIds.length > 0) {
      console.log(`\nFailed space IDs: ${failedSpaceIds.join(', ')}`);
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
