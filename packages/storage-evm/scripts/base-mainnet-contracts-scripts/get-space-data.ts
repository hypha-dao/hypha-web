import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

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
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Display space information
function displaySpaceInfo(spaceId: number, spaceData: any) {
  console.log('\n========== SPACE DETAILS ==========');
  console.log(`Space ID: ${spaceId}`);
  console.log(`Creator: ${spaceData.creator}`);
  console.log(`Executor: ${spaceData.executor}`);
  console.log(`Created at: ${formatDate(Number(spaceData.createdAt))}`);

  console.log('\n---------- Governance Parameters ----------');
  console.log(`Unity: ${spaceData.unity}%`);
  console.log(`Quorum: ${spaceData.quorum}%`);
  console.log(`Voting Power Source: ${spaceData.votingPowerSource}`);
  console.log(`Exit Method: ${spaceData.exitMethod}`);
  console.log(`Join Method: ${spaceData.joinMethod}`);

  console.log('\n---------- Members ----------');
  console.log(`Total members: ${spaceData.members.length}`);
  if (spaceData.members.length <= 10) {
    console.log('Member addresses:');
    spaceData.members.forEach((address: string, index: number) => {
      console.log(`  ${index + 1}. ${address}`);
    });
  } else {
    console.log('First 10 member addresses:');
    for (let i = 0; i < 10; i++) {
      console.log(`  ${i + 1}. ${spaceData.members[i]}`);
    }
    console.log(`  ... and ${spaceData.members.length - 10} more members`);
  }

  console.log('\n---------- Tokens ----------');
  if (spaceData.tokenAddresses.length === 0) {
    console.log('No tokens associated with this space.');
  } else {
    console.log('Token addresses:');
    spaceData.tokenAddresses.forEach((address: string, index: number) => {
      console.log(`  ${index + 1}. ${address}`);
    });
  }
}

// Function to process the space data into a more usable format
function processSpaceData(result: any) {
  return {
    unity: result[0],
    quorum: result[1],
    votingPowerSource: result[2],
    tokenAddresses: result[3],
    members: result[4],
    exitMethod: result[5],
    joinMethod: result[6],
    createdAt: result[7],
    creator: result[8],
    executor: result[9],
  };
}

async function findLatestSpaceIdByBinarySearch(
  contract: ethers.Contract,
): Promise<number> {
  let low = 1;
  let high = 1000; // Start with a reasonable upper bound

  console.log('Searching for valid space IDs...');

  // First, ensure there's at least one space and find a valid upper bound
  try {
    await contract.getSpaceDetails(1);
    console.log('Space ID 1 exists, continuing search...');
  } catch (error) {
    console.log('No spaces found starting from ID 1.');
    return 0;
  }

  // Find an upper bound
  while (true) {
    try {
      await contract.getSpaceDetails(high);
      low = high;
      high = high * 2;
      console.log(`Space ID ${high} exists, checking higher...`);
    } catch (error) {
      console.log(`Found upper bound at ${high}`);
      break;
    }
  }

  // Binary search between low and high
  console.log(`Performing binary search between ${low} and ${high}...`);
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    try {
      await contract.getSpaceDetails(mid);
      low = mid;
    } catch (error) {
      high = mid;
    }
  }

  console.log(`Latest valid space ID appears to be: ${low}`);
  return low;
}

async function getLatestSpaceIdWithFallback(
  contract: ethers.Contract,
): Promise<number> {
  try {
    // Try getting spaceCounter
    return Number(await contract.spaceCounter());
  } catch (error) {
    console.log('Could not call spaceCounter, trying binary search method...');
    return await findLatestSpaceIdByBinarySearch(contract);
  }
}

// Helper function to fetch and display a single space
async function fetchAndDisplaySpace(
  contract: ethers.Contract,
  userAddress: string,
  spaceId: number,
): Promise<void> {
  try {
    console.log(`\nFetching details for space ID: ${spaceId}...`);
    const spaceDataRaw = await contract.getSpaceDetails(spaceId);
    const spaceData = processSpaceData(spaceDataRaw);
    displaySpaceInfo(spaceId, spaceData);

    // Check if the user is a member of this space
    if (userAddress !== ethers.ZeroAddress) {
      const isMember = await contract.isMember(spaceId, userAddress);
      const isCreator = await contract.isSpaceCreator(spaceId, userAddress);

      console.log(`\nYour address: ${userAddress}`);
      console.log(
        `You are ${isMember ? 'a member' : 'not a member'} of this space`,
      );
      console.log(
        `You are ${
          isCreator ? 'the creator' : 'not the creator'
        } of this space`,
      );
    }
  } catch (error) {
    console.error('Error fetching space data:', error);
    console.log(`\nSpace ID ${spaceId} does not exist or is invalid.`);
  }
}

// Helper function to fetch a space range
async function fetchSpaceRange(
  contract: ethers.Contract,
  wallet: ethers.Wallet,
  startId: number,
  endId: number,
): Promise<void> {
  // Fetch each space in the range
  for (let id = startId; id <= endId; id++) {
    console.log(`\n----- SPACE ${id} -----`);
    try {
      const spaceDataRaw = await contract.getSpaceDetails(id);
      const spaceData = processSpaceData(spaceDataRaw);
      displaySpaceInfo(id, spaceData);

      if (wallet.address !== ethers.ZeroAddress) {
        const isMember = await contract.isMember(id, wallet.address);
        const isCreator = await contract.isSpaceCreator(id, wallet.address);

        console.log(`\nYour address: ${wallet.address}`);
        console.log(
          `You are ${isMember ? 'a member' : 'not a member'} of this space`,
        );
        console.log(
          `You are ${
            isCreator ? 'the creator' : 'not the creator'
          } of this space`,
        );
      }
    } catch (error) {
      console.log(`Could not load space ${id}`);
    }
  }
}

async function getSpaceData(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  // Default: get latest space
  let spaceId: number | null = null;
  let count = 1; // Default to just the latest one
  let showMemberSpaces = false;

  // Parse command line arguments
  if (command === 'id' && args.length > 1) {
    // Get specific space by ID
    spaceId = parseInt(args[1]);
    if (isNaN(spaceId)) {
      console.error('Invalid space ID. Please provide a valid number.');
      return;
    }
  } else if (command === 'latest') {
    // Latest is the default behavior
    spaceId = null;

    // Check if a count is specified (e.g., "latest 5" to get the 5 most recent spaces)
    if (args.length > 1) {
      count = parseInt(args[1]);
      if (isNaN(count) || count < 1) {
        count = 1;
      }
    }
  } else if (command === 'range' && args.length > 2) {
    // Handle range command
    const startId = parseInt(args[1]);
    const endId = parseInt(args[2]);
    if (isNaN(startId) || isNaN(endId)) {
      console.error('Invalid range. Please provide valid numbers.');
      return;
    }
    // Range will be handled separately below
  } else if (command === 'member' && args.length > 1) {
    // Show spaces where the specified address is a member
    showMemberSpaces = true;
  } else if (command && !isNaN(parseInt(command))) {
    // If first arg is just a number, treat it as a space ID
    spaceId = parseInt(command);
  }

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Initialize wallet
  let wallet;
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      wallet = new ethers.Wallet(cleanPrivateKey, provider);
      console.log(`Using wallet address: ${wallet.address}`);
    } else {
      wallet = ethers.Wallet.createRandom().connect(provider);
    }
  } catch (error) {
    console.error('Error setting up wallet:', error);
    return;
  }

  // Try multiple contract addresses if needed
  const contractAddresses = [
    process.env.DAO_SPACE_FACTORY_ADDRESS,
    '0x985Cf2c2c7c2196F5f3063c23274fED0Bce21775', // Example address, replace with actual default
  ].filter(Boolean) as string[]; // Remove undefined/null entries

  // Remove duplicates
  const uniqueAddresses = [...new Set(contractAddresses)];

  // Try each contract address until one works
  let daoSpaceFactory: ethers.Contract | null = null;
  let workingAddress: string | null = null;

  for (const address of uniqueAddresses) {
    console.log(`Trying DAO Space Factory contract at: ${address}`);
    const contract = new ethers.Contract(address, daoSpaceFactoryAbi, wallet);

    try {
      // Try a simple call to see if the contract is valid
      await contract.getSpaceDetails(1).catch(() => {
        // Intentionally empty - this is just a validation attempt
      });
      daoSpaceFactory = contract;
      workingAddress = address;
      console.log(`Successfully connected to DAO Space Factory at: ${address}`);
      break;
    } catch (error) {
      console.log(
        `Could not validate contract at ${address}, trying next address...`,
      );
    }
  }

  if (!daoSpaceFactory || !workingAddress) {
    console.error(
      `Could not connect to any DAO Space Factory contract. Please check the addresses.`,
    );
    return;
  }

  try {
    // Handle the special case for member spaces
    if (showMemberSpaces) {
      const memberAddress = args.length > 1 ? args[1] : wallet.address;
      console.log(`Fetching spaces for member: ${memberAddress}`);
      const memberSpaces = await daoSpaceFactory.getMemberSpaces(memberAddress);

      console.log(`\nMember belongs to ${memberSpaces.length} spaces:`);

      if (memberSpaces.length === 0) {
        console.log('No spaces found for this member.');
        return;
      }

      for (let i = 0; i < memberSpaces.length; i++) {
        const spaceId = Number(memberSpaces[i]);
        console.log(`\n----- SPACE ${spaceId} -----`);
        try {
          const spaceDataRaw = await daoSpaceFactory.getSpaceDetails(spaceId);
          const spaceData = processSpaceData(spaceDataRaw);
          displaySpaceInfo(spaceId, spaceData);
        } catch (error) {
          console.log(`Could not load space ${spaceId}`);
        }
      }
      return;
    }

    // Handle the special case for range command
    if (command === 'range' && args.length > 2) {
      const startId = parseInt(args[1]);
      const endId = parseInt(args[2]);
      console.log(`Fetching spaces in range: ${startId} to ${endId}`);
      await fetchSpaceRange(daoSpaceFactory, wallet, startId, endId);
      return;
    }

    // If a specific space ID was provided, just fetch that one
    if (spaceId !== null) {
      await fetchAndDisplaySpace(daoSpaceFactory, wallet.address, spaceId);
      return;
    }

    // Get the latest space ID
    console.log('Fetching latest space ID...');
    const latestSpaceId = await getLatestSpaceIdWithFallback(daoSpaceFactory);
    console.log(`Latest space ID: ${latestSpaceId}`);

    if (latestSpaceId === 0) {
      console.log(
        'No spaces have been created yet or could not determine the latest ID.',
      );
      return;
    }

    if (count === 1) {
      // Just get the latest space
      await fetchAndDisplaySpace(
        daoSpaceFactory,
        wallet.address,
        latestSpaceId,
      );
    } else {
      // Get multiple recent spaces
      console.log(`\nFetching the ${count} most recent spaces:`);

      // Calculate the start ID (make sure we don't go below 1)
      const startId = Math.max(1, latestSpaceId - count + 1);

      // Fetch each space
      await fetchSpaceRange(daoSpaceFactory, wallet, startId, latestSpaceId);
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nSomething went wrong. Check the error above for details.');
    console.log('\nIf you know the space ID, try specifying it directly:');
    console.log('  ts-node get-space-data.ts 123');
  }
}

// Run the script
getSpaceData().catch(console.error);
