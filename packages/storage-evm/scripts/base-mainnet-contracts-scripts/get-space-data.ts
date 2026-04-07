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
  isMember: (spaceId: number, userAddress: string) => Promise<boolean>;
  isSpaceCreator: (spaceId: number, userAddress: string) => Promise<boolean>;
  getMemberSpaces: (memberAddress: string) => Promise<bigint[]>;
}

// DAOSpaceFactory ABI with necessary functions
const daoSpaceFactoryAbi = [
  {
    inputs: [],
    name: 'spaceCounter',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceDetails',
    outputs: [
      { internalType: 'uint256', name: 'unity', type: 'uint256' },
      { internalType: 'uint256', name: 'quorum', type: 'uint256' },
      { internalType: 'uint256', name: 'votingPowerSource', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { internalType: 'address[]', name: 'members', type: 'address[]' },
      { internalType: 'uint256', name: 'exitMethod', type: 'uint256' },
      { internalType: 'uint256', name: 'joinMethod', type: 'uint256' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'address', name: 'creator', type: 'address' },
      { internalType: 'address', name: 'executor', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_userAddress', type: 'address' },
    ],
    name: 'isMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_userAddress', type: 'address' },
    ],
    name: 'isSpaceCreator',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_memberAddress', type: 'address' },
    ],
    name: 'getMemberSpaces',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Helper function to format date
function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

// Display space information
function displaySpaceInfo(
  spaceId: number,
  spaceDetails: SpaceDetails,
  userAddress?: string,
  isMember?: boolean,
  isCreator?: boolean,
) {
  console.log(`\n=== Space ${spaceId} ===`);
  console.log('Unity:', Number(spaceDetails.unity), '%');
  console.log('Quorum:', Number(spaceDetails.quorum), '%');
  console.log('Voting Power Source:', Number(spaceDetails.votingPowerSource));
  console.log('Exit Method:', Number(spaceDetails.exitMethod));
  console.log('Join Method:', Number(spaceDetails.joinMethod));
  console.log('Created At:', formatDate(spaceDetails.createdAt));
  console.log('Creator:', spaceDetails.creator);
  console.log('Executor:', spaceDetails.executor);

  console.log('\n--- Members ---');
  console.log('Number of Members:', spaceDetails.members.length);
  if (spaceDetails.members.length <= 10) {
    console.log('Member addresses:');
    spaceDetails.members.forEach((address: string, index: number) => {
      console.log(`  ${index + 1}. ${address}`);
    });
  } else {
    console.log('First 10 member addresses:');
    for (let i = 0; i < 10; i++) {
      console.log(`  ${i + 1}. ${spaceDetails.members[i]}`);
    }
    console.log(`  ... and ${spaceDetails.members.length - 10} more members`);
  }

  console.log('\n--- Tokens ---');
  if (spaceDetails.tokenAddresses.length === 0) {
    console.log('No tokens associated with this space.');
  } else {
    console.log('Token addresses:');
    spaceDetails.tokenAddresses.forEach((address: string, index: number) => {
      console.log(`  ${index + 1}. ${address}`);
    });
  }

  if (userAddress && userAddress !== ethers.ZeroAddress) {
    console.log('\n--- Your Status ---');
    console.log('Your address:', userAddress);
    console.log(
      'You are',
      isMember ? 'a member' : 'not a member',
      'of this space',
    );
    console.log(
      'You are',
      isCreator ? 'the creator' : 'not the creator',
      'of this space',
    );
  }

  console.log('===============\n');
}

function parseArguments(): {
  mode: 'latest' | 'id' | 'range' | 'member';
  spaceId?: number;
  count?: number;
  startId?: number;
  endId?: number;
  memberAddress?: string;
} {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: ts-node get-space-data.ts [options]

Modes:
  (no args)                       Get latest space
  latest [count]                  Get latest N spaces (default: 1)
  id <spaceId>                    Get specific space by ID
  <spaceId>                       Get specific space by ID (short form)
  range <start> <end>             Get spaces in range
  member [address]                Get spaces for member (uses your wallet if no address)

Examples:
  ts-node get-space-data.ts                    # Get latest space
  ts-node get-space-data.ts latest 5          # Get 5 most recent spaces
  ts-node get-space-data.ts id 123            # Get specific space ID
  ts-node get-space-data.ts 123               # Get specific space ID (short form)
  ts-node get-space-data.ts range 1 10        # Get spaces 1 through 10
  ts-node get-space-data.ts member 0x123...   # Get spaces for a member address
  ts-node get-space-data.ts member             # Get spaces for your wallet

Environment Variables Required:
  RPC_URL                                     # Base mainnet RPC endpoint
  DAO_SPACE_FACTORY_ADDRESS                   # Contract address
  PRIVATE_KEY                                 # Your wallet private key (optional)
    `);
    process.exit(0);
  }

  const result: ReturnType<typeof parseArguments> = { mode: 'latest' };

  if (args.length === 0) {
    return result;
  }

  const command = args[0].toLowerCase();

  if (command === 'latest') {
    result.mode = 'latest';
    if (args.length > 1) {
      result.count = parseInt(args[1], 10);
      if (isNaN(result.count) || result.count < 1) {
        result.count = 1;
      }
    } else {
      result.count = 1;
    }
  } else if (command === 'id' && args.length > 1) {
    result.mode = 'id';
    result.spaceId = parseInt(args[1], 10);
    if (isNaN(result.spaceId)) {
      throw new Error('Invalid space ID. Please provide a valid number.');
    }
  } else if (command === 'range' && args.length > 2) {
    result.mode = 'range';
    result.startId = parseInt(args[1], 10);
    result.endId = parseInt(args[2], 10);
    if (isNaN(result.startId) || isNaN(result.endId)) {
      throw new Error('Invalid range. Please provide valid numbers.');
    }
  } else if (command === 'member') {
    result.mode = 'member';
    if (args.length > 1) {
      result.memberAddress = args[1];
    }
  } else if (!isNaN(parseInt(command))) {
    // If first arg is just a number, treat it as a space ID
    result.mode = 'id';
    result.spaceId = parseInt(command);
  } else {
    throw new Error(
      `Unknown command: ${command}. Use --help for usage information.`,
    );
  }

  return result;
}

async function fetchSpaceDetails(
  contract: ethers.Contract & DAOSpaceFactoryInterface,
  spaceId: number,
  userAddress?: string,
): Promise<void> {
  try {
    const spaceDetails = await contract.getSpaceDetails(spaceId);

    // Check if this is a valid space (has a creator address)
    if (spaceDetails.creator === ethers.ZeroAddress) {
      console.log(`Space ${spaceId}: Invalid (zero creator address)`);
      return;
    }

    let isMember: boolean | undefined;
    let isCreator: boolean | undefined;

    if (userAddress && userAddress !== ethers.ZeroAddress) {
      try {
        [isMember, isCreator] = await Promise.all([
          contract.isMember(spaceId, userAddress),
          contract.isSpaceCreator(spaceId, userAddress),
        ]);
      } catch (error) {
        console.warn(
          `Could not check membership status for space ${spaceId}:`,
          error,
        );
      }
    }

    displaySpaceInfo(spaceId, spaceDetails, userAddress, isMember, isCreator);
  } catch (error: any) {
    if (error.code === 'CALL_EXCEPTION') {
      console.log(`Space ${spaceId}: Does not exist`);
    } else {
      console.error(`Space ${spaceId}: Error - ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const options = parseArguments();

    // Connect to the network
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL environment variable is required');
    }

    console.log('Connecting to network...');
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Test connection
    try {
      const network = await provider.getNetwork();
      console.log(
        `Connected to network: ${network.name} (Chain ID: ${network.chainId})`,
      );
    } catch (error) {
      throw new Error(`Failed to connect to RPC endpoint: ${error}`);
    }

    // Setup wallet (optional)
    let userAddress: string | undefined;
    if (process.env.PRIVATE_KEY) {
      try {
        const cleanPrivateKey = process.env.PRIVATE_KEY.startsWith('0x')
          ? process.env.PRIVATE_KEY.slice(2)
          : process.env.PRIVATE_KEY;
        const wallet = new ethers.Wallet(cleanPrivateKey, provider);
        userAddress = wallet.address;
        console.log(`Using wallet address: ${userAddress}`);
      } catch (error) {
        console.warn(
          'Invalid PRIVATE_KEY, continuing without wallet functionality',
        );
      }
    } else {
      console.log(
        'No PRIVATE_KEY provided, membership status will not be checked',
      );
    }

    // Get the contract instance
    const contractAddress = process.env.DAO_SPACE_FACTORY_ADDRESS;
    if (!contractAddress) {
      throw new Error(
        'DAO_SPACE_FACTORY_ADDRESS environment variable is required',
      );
    }

    const contract = new ethers.Contract(
      contractAddress,
      daoSpaceFactoryAbi,
      provider,
    ) as ethers.Contract & DAOSpaceFactoryInterface;

    // Test contract connection
    try {
      const spaceCounter = await contract.spaceCounter();
      console.log(`Total spaces in contract: ${spaceCounter}\n`);
    } catch (error) {
      throw new Error(
        `Failed to connect to contract at ${contractAddress}: ${error}`,
      );
    }

    // Execute based on mode
    switch (options.mode) {
      case 'id':
        if (options.spaceId !== undefined) {
          await fetchSpaceDetails(contract, options.spaceId, userAddress);
        }
        break;

      case 'latest': {
        const spaceCounter = await contract.spaceCounter();
        const latestSpaceId = Number(spaceCounter);

        if (latestSpaceId === 0) {
          console.log('No spaces have been created yet.');
          break;
        }

        const count = options.count || 1;
        console.log(`Fetching the ${count} most recent spaces:\n`);

        const startId = Math.max(1, latestSpaceId - count + 1);

        for (let spaceId = startId; spaceId <= latestSpaceId; spaceId++) {
          await fetchSpaceDetails(contract, spaceId, userAddress);
        }
        break;
      }

      case 'range':
        if (options.startId !== undefined && options.endId !== undefined) {
          console.log(
            `Fetching spaces ${options.startId} to ${options.endId}:\n`,
          );

          for (
            let spaceId = options.startId;
            spaceId <= options.endId;
            spaceId++
          ) {
            await fetchSpaceDetails(contract, spaceId, userAddress);
          }
        }
        break;

      case 'member': {
        const memberAddress = options.memberAddress || userAddress;

        if (!memberAddress) {
          throw new Error(
            'No member address provided and no wallet configured. Please provide an address or set PRIVATE_KEY.',
          );
        }

        console.log(`Fetching spaces for member: ${memberAddress}\n`);

        try {
          const memberSpaces = await contract.getMemberSpaces(memberAddress);
          console.log(`Member belongs to ${memberSpaces.length} spaces:\n`);

          if (memberSpaces.length === 0) {
            console.log('No spaces found for this member.');
            break;
          }

          for (const spaceIdBigint of memberSpaces) {
            const spaceId = Number(spaceIdBigint);
            await fetchSpaceDetails(contract, spaceId, userAddress);
          }
        } catch (error) {
          console.error('Error fetching member spaces:', error);
        }
        break;
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);

    if (error.message.includes('RPC_URL')) {
      console.log('\nPlease set RPC_URL in your .env file. Example:');
      console.log('RPC_URL=https://mainnet.base.org');
    }

    if (error.message.includes('DAO_SPACE_FACTORY_ADDRESS')) {
      console.log('\nPlease set DAO_SPACE_FACTORY_ADDRESS in your .env file.');
    }

    console.log('\nFor help, run: ts-node get-space-data.ts --help');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
