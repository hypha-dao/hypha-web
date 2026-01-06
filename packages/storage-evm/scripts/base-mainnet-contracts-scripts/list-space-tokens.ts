import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Base Mainnet contract addresses
const CONTRACTS = {
  //REGULAR_TOKEN_FACTORY: '0x95A33EC94de2189893884DaD63eAa19f7390144a',
  REGULAR_TOKEN_FACTORY: '0x299f4D2327933c1f363301dbd2a28379ccD5539b',
  DAO_SPACE_FACTORY: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
};

interface RegularTokenFactoryInterface {
  getSpaceToken: (spaceId: number) => Promise<string[]>;
}

interface DAOSpaceFactoryInterface {
  spaceCounter: () => Promise<bigint>;
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

async function getTokensForSpace(
  tokenFactory: ethers.Contract & RegularTokenFactoryInterface,
  spaceId: number,
): Promise<void> {
  try {
    const tokenAddresses = await tokenFactory.getSpaceToken(spaceId);

    if (tokenAddresses.length === 0) {
      console.log(`Space ${spaceId}: No tokens deployed`);
    } else if (tokenAddresses.length === 1) {
      console.log(`Space ${spaceId}: 1 token deployed at ${tokenAddresses[0]}`);
    } else {
      console.log(
        `Space ${spaceId}: ${tokenAddresses.length} tokens deployed:`,
      );
      tokenAddresses.forEach((address, index) => {
        console.log(`  ${index + 1}. ${address}`);
      });
    }
  } catch (error: any) {
    console.error(`Error fetching tokens for space ${spaceId}:`, error.message);
  }
}

async function main(): Promise<void> {
  // Validate required environment variables
  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Get the RegularTokenFactory contract instance
  const regularTokenFactory = new ethers.Contract(
    CONTRACTS.REGULAR_TOKEN_FACTORY,
    regularTokenFactoryAbi,
    provider,
  ) as ethers.Contract & RegularTokenFactoryInterface;

  // Get the DAOSpaceFactory contract instance to get total space count
  const daoSpaceFactory = new ethers.Contract(
    CONTRACTS.DAO_SPACE_FACTORY,
    daoSpaceFactoryAbi,
    provider,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  try {
    // Check if a specific space ID is provided as command line argument
    const args = process.argv.slice(2);

    if (args.length > 0) {
      // Query specific space ID(s)
      for (const arg of args) {
        const spaceId = parseInt(arg);
        if (isNaN(spaceId)) {
          console.error(`Invalid space ID: ${arg}`);
          continue;
        }
        console.log(`\n=== Querying Space ${spaceId} ===`);
        await getTokensForSpace(regularTokenFactory, spaceId);
      }
    } else {
      // Query all spaces
      const spaceCounter = await daoSpaceFactory.spaceCounter();
      console.log(`Total number of spaces: ${spaceCounter}`);
      console.log('\n=== Token Addresses for All Spaces ===\n');

      const spacesWithTokens: Array<{
        spaceId: number;
        tokenAddresses: string[];
      }> = [];
      const spacesWithoutTokens: number[] = [];

      // Iterate through all spaces
      for (let spaceId = 1; spaceId <= Number(spaceCounter); spaceId++) {
        try {
          const tokenAddresses = await regularTokenFactory.getSpaceToken(
            spaceId,
          );

          if (tokenAddresses.length === 0) {
            spacesWithoutTokens.push(spaceId);
          } else {
            spacesWithTokens.push({ spaceId, tokenAddresses });
            if (tokenAddresses.length === 1) {
              console.log(`Space ${spaceId}: 1 token at ${tokenAddresses[0]}`);
            } else {
              console.log(`Space ${spaceId}: ${tokenAddresses.length} tokens:`);
              tokenAddresses.forEach((address, index) => {
                console.log(`  ${index + 1}. ${address}`);
              });
            }
          }
        } catch (error: any) {
          console.error(
            `Error fetching tokens for space ${spaceId}:`,
            error.message,
          );
          spacesWithoutTokens.push(spaceId);
        }
      }

      // Calculate total tokens
      const totalTokens = spacesWithTokens.reduce(
        (sum, space) => sum + space.tokenAddresses.length,
        0,
      );

      // Summary
      console.log('\n=== Summary ===');
      console.log(`Total spaces: ${spaceCounter}`);
      console.log(`Spaces with tokens: ${spacesWithTokens.length}`);
      console.log(`Spaces without tokens: ${spacesWithoutTokens.length}`);
      console.log(`Total tokens deployed: ${totalTokens}`);

      if (spacesWithTokens.length > 0) {
        const avgTokensPerSpace = (
          totalTokens / spacesWithTokens.length
        ).toFixed(2);
        console.log(
          `Average tokens per space (with tokens): ${avgTokensPerSpace}`,
        );
      }

      if (spacesWithoutTokens.length > 0) {
        console.log(
          `\nSpaces without tokens: ${spacesWithoutTokens.join(', ')}`,
        );
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
