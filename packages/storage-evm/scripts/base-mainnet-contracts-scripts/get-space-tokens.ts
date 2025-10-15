import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface ParsedArgs {
  spaceId?: number;
}

const regularTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
    ],
    name: 'getSpaceToken',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
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

    if ((arg === '--space' || arg === '--spaceId') && i + 1 < args.length) {
      result.spaceId = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx get-space-tokens.ts [options]

Options:
  --space, --spaceId <number>    Space ID to query (required)
  --help, -h                     Show this help message

Examples:
  npx tsx get-space-tokens.ts --space 413
  npx tsx get-space-tokens.ts --spaceId 413
      `);
      process.exit(0);
    } else if (!isNaN(parseInt(arg, 10))) {
      // If a plain number is provided, treat it as spaceId
      result.spaceId = parseInt(arg, 10);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const { spaceId } = parseArguments();

  if (spaceId === undefined) {
    console.error('Error: Space ID is required');
    console.log('Usage: npx tsx get-space-tokens.ts --space <spaceId>');
    console.log('Or run with --help for more information');
    process.exit(1);
  }

  // Contract addresses
  const REGULAR_TOKEN_FACTORY_ADDRESS =
    '0x95A33EC94de2189893884DaD63eAa19f7390144a'; // RegularTokenFactory Proxy

  // Connect to the network
  const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Get the contract instance
  const regularTokenFactory = new ethers.Contract(
    REGULAR_TOKEN_FACTORY_ADDRESS,
    regularTokenFactoryAbi,
    provider,
  );

  try {
    console.log(`Querying tokens for Space ID: ${spaceId}\n`);

    const tokenAddresses = await regularTokenFactory.getSpaceToken(spaceId);

    console.log(`=== Space ${spaceId} Tokens ===`);
    console.log(`Number of tokens: ${tokenAddresses.length}`);

    if (tokenAddresses.length === 0) {
      console.log('No tokens found for this space');
    } else {
      console.log('\nToken Addresses:');
      tokenAddresses.forEach((address: string, index: number) => {
        console.log(`  ${index + 1}. ${address}`);
      });
    }
    console.log('===============\n');
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
