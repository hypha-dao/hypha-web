import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Base Mainnet contract addresses
const CONTRACTS = {
  OWNERSHIP_TOKEN_FACTORY: '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6',
  DAO_SPACE_FACTORY: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
};

interface OwnershipTokenFactoryInterface {
  getSpaceToken: (spaceId: number) => Promise<string>;
}

interface DAOSpaceFactoryInterface {
  spaceCounter: () => Promise<bigint>;
}

const ownershipTokenFactoryAbi = [
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
        internalType: 'address',
        name: '',
        type: 'address',
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

async function getOwnershipTokenForSpace(
  tokenFactory: ethers.Contract & OwnershipTokenFactoryInterface,
  spaceId: number,
): Promise<void> {
  try {
    const tokenAddress = await tokenFactory.getSpaceToken(spaceId);

    if (tokenAddress === ethers.ZeroAddress) {
      console.log(`Space ${spaceId}: No ownership token deployed`);
    } else {
      console.log(
        `Space ${spaceId}: Ownership token deployed at ${tokenAddress}`,
      );
    }
  } catch (error: any) {
    console.error(
      `Error fetching ownership token for space ${spaceId}:`,
      error.message,
    );
  }
}

async function checkContractInterface(
  provider: ethers.JsonRpcProvider,
): Promise<boolean> {
  console.log('Checking OwnershipTokenFactory contract interface...');

  // First check if contract exists
  const code = await provider.getCode(CONTRACTS.OWNERSHIP_TOKEN_FACTORY);
  if (code === '0x') {
    console.log('❌ No contract deployed at this address!');
    return false;
  }
  console.log('✅ Contract is deployed');

  // Try different possible function signatures
  const testAbi = [
    'function getSpaceToken(uint256) view returns (address)',
    'function spaceTokens(uint256) view returns (address)',
    'function tokens(uint256) view returns (address)',
    'function getToken(uint256) view returns (address)',
  ];

  const contract = new ethers.Contract(
    CONTRACTS.OWNERSHIP_TOKEN_FACTORY,
    testAbi,
    provider,
  );

  const testFunctions = ['getSpaceToken', 'spaceTokens', 'tokens', 'getToken'];
  let foundFunction = false;

  for (const funcName of testFunctions) {
    try {
      console.log(`Testing function: ${funcName}...`);
      // Try with a space that definitely exists (space 1)
      const result = await contract[funcName](1);
      console.log(
        `✅ Function ${funcName} exists! Result for space 1: ${result}`,
      );
      foundFunction = true;

      if (funcName !== 'getSpaceToken') {
        console.log(
          `⚠️  Note: Function name is ${funcName}, not getSpaceToken`,
        );
      }

      break;
    } catch (error: any) {
      if (error.code === 'CALL_EXCEPTION') {
        console.log(
          `✅ Function ${funcName} exists but reverted (likely no token for space 1)`,
        );
        foundFunction = true;

        if (funcName !== 'getSpaceToken') {
          console.log(
            `⚠️  Note: Function name is ${funcName}, not getSpaceToken`,
          );
        }

        break;
      } else {
        console.log(
          `❌ Function ${funcName} does not exist or failed: ${
            error.message.split('(')[0]
          }`,
        );
      }
    }
  }

  if (!foundFunction) {
    console.log('❌ No compatible function found on the contract');
  }

  return foundFunction;
}

async function main(): Promise<void> {
  // Validate required environment variables
  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Check if the contract has the expected interface
  const hasValidInterface = await checkContractInterface(provider);
  if (!hasValidInterface) {
    throw new Error(
      'OwnershipTokenFactory contract does not have the expected interface',
    );
  }
  console.log(''); // Add blank line for readability

  // Get the OwnershipTokenFactory contract instance
  const ownershipTokenFactory = new ethers.Contract(
    CONTRACTS.OWNERSHIP_TOKEN_FACTORY,
    ownershipTokenFactoryAbi,
    provider,
  ) as ethers.Contract & OwnershipTokenFactoryInterface;

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
        console.log(`\n=== Querying Ownership Token for Space ${spaceId} ===`);
        await getOwnershipTokenForSpace(ownershipTokenFactory, spaceId);
      }
    } else {
      // Query all spaces
      const spaceCounter = await daoSpaceFactory.spaceCounter();
      console.log(`Total number of spaces: ${spaceCounter}`);
      console.log('\n=== Ownership Token Addresses for All Spaces ===\n');

      const spacesWithTokens: Array<{ spaceId: number; tokenAddress: string }> =
        [];
      const spacesWithoutTokens: number[] = [];

      // Iterate through all spaces
      for (let spaceId = 1; spaceId <= Number(spaceCounter); spaceId++) {
        try {
          const tokenAddress = await ownershipTokenFactory.getSpaceToken(
            spaceId,
          );

          if (tokenAddress === ethers.ZeroAddress) {
            spacesWithoutTokens.push(spaceId);
          } else {
            spacesWithTokens.push({ spaceId, tokenAddress });
            console.log(`Space ${spaceId}: ${tokenAddress}`);
          }
        } catch (error: any) {
          console.error(
            `Error fetching ownership token for space ${spaceId}:`,
            error.message,
          );
          spacesWithoutTokens.push(spaceId);
        }
      }

      // Summary
      console.log('\n=== Summary ===');
      console.log(`Total spaces: ${spaceCounter}`);
      console.log(`Spaces with ownership tokens: ${spacesWithTokens.length}`);
      console.log(
        `Spaces without ownership tokens: ${spacesWithoutTokens.length}`,
      );

      if (spacesWithoutTokens.length > 0) {
        console.log(
          `\nSpaces without ownership tokens: ${spacesWithoutTokens.join(
            ', ',
          )}`,
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
