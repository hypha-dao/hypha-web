import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

// Common function signatures for decoding
const FUNCTION_SIGNATURES: { [key: string]: string } = {
  // ERC20 functions
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  '0x40c10f19': 'mint(address,uint256)',
  '0x42966c68': 'burn(uint256)',
  '0x9dc29fac': 'burnFrom(address,uint256)',
  '0x70a08231': 'balanceOf(address)',
  '0xdd62ed3e': 'allowance(address,address)',
  '0xa0712d68': 'mint(uint256)',
  '0x1249c58b': 'mintMany(address[],uint256[])',

  // Governance functions
  '0x15373e3d': 'vote(uint256,bool)',
  '0xda95691a': 'execute(uint256)',
  '0xc01a8c84': 'executeProposal(uint256)',

  // DAO management
  '0x13af4035': 'setOwner(address)',
  '0xf2fde38b': 'transferOwnership(address)',
  '0x715018a6': 'renounceOwnership()',

  // Space/Member management
  '0xca6d56dc': 'addMember(address,uint256)',
  '0x095cf5c6': 'removeMember(address)',
  '0x0a3b0a4f': 'updateMember(address,uint256)',

  // DAO Space Factory functions
  '0x74d0a676': 'addMember(uint256,address)',
  '0x0fc0f7c5': 'joinSpace(uint256)',
  '0x719e4c4c': 'removeMember(uint256,address)',
  '0x9f3c57e7': 'createSpace((uint256,uint256,uint256,uint256,uint256))',

  // Common utility functions
  '0x3659cfe6': 'upgradeTo(address)',
  '0x4f1ef286': 'upgradeToAndCall(address,bytes)',

  // Add more as needed
};

interface AccountData {
  privateKey: string;
  address: string;
}

// DAOProposals ABI with necessary functions
const daoProposalsAbi = [
  {
    inputs: [],
    name: 'getLatestProposalId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'getProposalCore',
    outputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'bool', name: 'executed', type: 'bool' },
      { internalType: 'bool', name: 'expired', type: 'bool' },
      { internalType: 'uint256', name: 'yesVotes', type: 'uint256' },
      { internalType: 'uint256', name: 'noVotes', type: 'uint256' },
      {
        internalType: 'uint256',
        name: 'totalVotingPowerAtSnapshot',
        type: 'uint256',
      },
      { internalType: 'address', name: 'creator', type: 'address' },
      {
        internalType: 'tuple[]',
        name: 'transactions',
        type: 'tuple[]',
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
      { internalType: 'address', name: '_voter', type: 'address' },
    ],
    name: 'hasVoted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Add proposalCounter getter as fallback
  {
    inputs: [],
    name: 'proposalCounter',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Add function to get voters
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'getProposalVoters',
    outputs: [
      { internalType: 'address[]', name: 'yesVoters', type: 'address[]' },
      { internalType: 'address[]', name: 'noVoters', type: 'address[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Helper function to calculate voting statistics
function calculateVotingStats(
  yesVotes: bigint,
  noVotes: bigint,
  totalPower: bigint,
) {
  const totalVotes = yesVotes + noVotes;

  // Calculate percentages (with protection against division by zero)
  const yesPercentOfTotal =
    totalPower > 0n ? Number((yesVotes * 100n) / totalPower) : 0;
  const noPercentOfTotal =
    totalPower > 0n ? Number((noVotes * 100n) / totalPower) : 0;

  const yesPercentOfVoted =
    totalVotes > 0n ? Number((yesVotes * 100n) / totalVotes) : 0;
  const noPercentOfVoted =
    totalVotes > 0n ? Number((noVotes * 100n) / totalVotes) : 0;

  const participationRate =
    totalPower > 0n ? Number((totalVotes * 100n) / totalPower) : 0;

  return {
    yesPercentOfTotal,
    noPercentOfTotal,
    yesPercentOfVoted,
    noPercentOfVoted,
    participationRate,
  };
}

// Function to determine the proposal status
function getProposalStatus(proposalData: any): string {
  const currentTime = Math.floor(Date.now() / 1000);

  if (proposalData.executed) return 'Executed';
  if (proposalData.expired) return 'Expired';
  if (currentTime < Number(proposalData.startTime)) return 'Pending';
  if (currentTime > Number(proposalData.endTime)) return 'Ended (Not Executed)';
  return 'Active';
}

// Function to decode transaction data
function decodeTransactionData(data: string): {
  selector: string;
  signature?: string;
  decodedParams?: any;
  error?: string;
  warning?: string;
} {
  if (!data || data === '0x' || data.length < 10) {
    return {
      selector: 'N/A',
      error: 'No data or invalid data',
    };
  }

  const selector = data.slice(0, 10);
  const signature = FUNCTION_SIGNATURES[selector];

  if (!signature) {
    return {
      selector,
      warning: 'Unknown function signature (not in local database)',
      error: `Try looking up ${selector} at https://www.4byte.directory/signatures/?bytes4_signature=${selector}`,
    };
  }

  try {
    // Parse the function signature to get parameter types
    const match = signature.match(/\((.*)\)/);
    if (!match) {
      return {
        selector,
        signature,
        error: 'Could not parse function signature',
      };
    }

    const paramTypes = match[1].split(',').filter((p) => p.trim());
    if (paramTypes.length === 0) {
      return {
        selector,
        signature,
        decodedParams: [],
      };
    }

    // Decode the parameters
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const paramData = '0x' + data.slice(10);
    const decoded = abiCoder.decode(paramTypes, paramData);

    // Convert to a more readable format
    const decodedParams = paramTypes.map((type, index) => {
      let value = decoded[index];

      // Format based on type
      if (type.includes('uint') || type.includes('int')) {
        value = value.toString();
      } else if (type === 'address') {
        value = value.toString();
      } else if (type === 'bytes' && !type.includes('[]')) {
        // Keep bytes as hex string
        value = value.toString();
      } else if (type.includes('[]')) {
        // Handle arrays
        if (Array.isArray(value)) {
          value = value.map((v) => {
            if (typeof v === 'bigint') {
              return v.toString();
            }
            return v.toString();
          });
        }
      }

      return {
        type,
        value,
      };
    });

    return {
      selector,
      signature,
      decodedParams,
    };
  } catch (error) {
    return {
      selector,
      signature,
      error: `Decoding error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

// Display proposal information
function displayProposalInfo(
  proposalId: number,
  proposalData: any,
  yesVoters?: string[],
  noVoters?: string[],
) {
  // Get proposal status
  const status = getProposalStatus(proposalData);

  // Calculate voting statistics
  const stats = calculateVotingStats(
    proposalData.yesVotes,
    proposalData.noVotes,
    proposalData.totalVotingPowerAtSnapshot,
  );

  // Display proposal information in a more detailed format
  console.log('\n========== PROPOSAL DETAILS ==========');
  console.log(`Proposal ID: ${proposalId}`);
  console.log(`Space ID: ${proposalData.spaceId}`);
  console.log(`Status: ${status}`);
  console.log(`Creator: ${proposalData.creator}`);

  console.log('\n---------- Timing ----------');
  console.log(`Start time: ${formatDate(Number(proposalData.startTime))}`);
  console.log(`End time: ${formatDate(Number(proposalData.endTime))}`);

  const duration =
    Number(proposalData.endTime) - Number(proposalData.startTime);
  const durationInHours = duration / 3600;
  console.log(`Duration: ${durationInHours.toFixed(1)} hours`);

  // Calculate time remaining if active
  if (status === 'Active') {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = Number(proposalData.endTime) - currentTime;
    const hoursRemaining = timeRemaining / 3600;
    console.log(`Time remaining: ${hoursRemaining.toFixed(1)} hours`);
  }

  console.log('\n---------- Voting Results ----------');
  console.log(
    `Yes votes: ${proposalData.yesVotes.toString()} (${stats.yesPercentOfVoted.toFixed(
      2,
    )}% of voted)`,
  );
  console.log(
    `No votes: ${proposalData.noVotes.toString()} (${stats.noPercentOfVoted.toFixed(
      2,
    )}% of voted)`,
  );
  console.log(
    `Total voted: ${(proposalData.yesVotes + proposalData.noVotes).toString()}`,
  );
  console.log(
    `Total voting power: ${proposalData.totalVotingPowerAtSnapshot.toString()}`,
  );
  console.log(`Participation rate: ${stats.participationRate.toFixed(2)}%`);

  // Display voters if available
  if (yesVoters && yesVoters.length > 0) {
    console.log(`\n---------- Yes Voters (${yesVoters.length}) ----------`);
    yesVoters.forEach((voter, index) => {
      console.log(`${index + 1}. ${voter}`);
    });
  }

  if (noVoters && noVoters.length > 0) {
    console.log(`\n---------- No Voters (${noVoters.length}) ----------`);
    noVoters.forEach((voter, index) => {
      console.log(`${index + 1}. ${voter}`);
    });
  }

  // Display transaction data if available
  if (proposalData.transactions && proposalData.transactions.length > 0) {
    console.log('\n---------- Transactions ----------');
    proposalData.transactions.forEach((tx: any, index: number) => {
      console.log(`\nTransaction #${index + 1}:`);
      console.log(`Target: ${tx.target}`);

      // Format value based on size
      const valueInWei = BigInt(tx.value.toString());
      if (valueInWei > 0n) {
        const valueInEth = ethers.formatEther(valueInWei);
        console.log(`Value: ${valueInWei.toString()} wei (${valueInEth} ETH)`);
      } else {
        console.log(`Value: 0`);
      }

      // Decode the transaction data
      const decoded = decodeTransactionData(tx.data);

      console.log(`\n  Call Data:`);
      console.log(`  Function Selector: ${decoded.selector}`);

      if (decoded.signature) {
        console.log(`  Function Signature: ${decoded.signature}`);
      }

      if (decoded.warning) {
        console.log(`  ⚠️  ${decoded.warning}`);
      }

      if (decoded.decodedParams && decoded.decodedParams.length > 0) {
        console.log(`  Decoded Parameters:`);
        decoded.decodedParams.forEach((param: any, paramIndex: number) => {
          const paramName =
            decoded.signature
              ?.match(/\((.*?)\)/)?.[1]
              .split(',')
              [paramIndex]?.split(' ')[1] || `param${paramIndex}`;
          console.log(
            `    ${paramIndex + 1}. ${param.type}: ${
              Array.isArray(param.value)
                ? `[\n        ${param.value.join(',\n        ')}\n      ]`
                : param.value
            }`,
          );
        });
      }

      if (decoded.error) {
        console.log(`  ℹ️  ${decoded.error}`);
        console.log(`  Raw Data: ${tx.data}`);
      }

      // Always show raw data for reference
      if (!decoded.error || tx.data.length < 200) {
        console.log(`  Raw Data: ${tx.data}`);
      }
    });
  }

  // Additional information about execution/expiration
  if (proposalData.executed) {
    console.log('\nThis proposal has been executed.');
  } else if (proposalData.expired) {
    console.log('\nThis proposal has expired without being executed.');
  }
}

async function getLatestProposalIdWithFallback(
  contract: ethers.Contract,
): Promise<number> {
  try {
    // First try the getLatestProposalId function
    return Number(await contract.getLatestProposalId());
  } catch (error) {
    console.log('Could not call getLatestProposalId, trying fallback...');

    try {
      // Try to access proposalCounter directly as a fallback
      return Number(await contract.proposalCounter());
    } catch (fallbackError) {
      console.log('Fallback also failed. Using binary search method...');

      // Use binary search to find the latest proposal ID
      return await findLatestProposalIdByBinarySearch(contract);
    }
  }
}

// Helper function to find the latest proposal ID using binary search
async function findLatestProposalIdByBinarySearch(
  contract: ethers.Contract,
): Promise<number> {
  let low = 1;
  let high = 1000; // Start with a reasonable upper bound

  console.log('Searching for valid proposal IDs...');

  // First, ensure there's at least one proposal and find a valid upper bound
  try {
    await contract.getProposalCore(1);
    console.log('Proposal ID 1 exists, continuing search...');
  } catch (error) {
    console.log('No proposals found starting from ID 1.');
    return 0;
  }

  // Find an upper bound
  while (true) {
    try {
      await contract.getProposalCore(high);
      low = high;
      high = high * 2;
      console.log(`Proposal ID ${high} exists, checking higher...`);
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
      await contract.getProposalCore(mid);
      low = mid;
    } catch (error) {
      high = mid;
    }
  }

  console.log(`Latest valid proposal ID appears to be: ${low}`);
  return low;
}

async function getProposalData(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  // Default: get latest proposal
  let proposalId: number | null = null;
  let count = 1; // Default to just the latest one
  let checkAddress: string | null = null; // Address to check voting status

  // Parse command line arguments
  if (command === 'id' && args.length > 1) {
    // Get specific proposal by ID
    proposalId = parseInt(args[1]);
    if (isNaN(proposalId)) {
      console.error('Invalid proposal ID. Please provide a valid number.');
      return;
    }
    // Check if there's an address to check
    if (args.length > 2 && args[2].startsWith('0x')) {
      checkAddress = args[2];
    }
  } else if (command === 'latest') {
    // Latest is the default behavior
    proposalId = null;

    // Check if a count is specified (e.g., "latest 5" to get the 5 most recent proposals)
    if (args.length > 1) {
      count = parseInt(args[1]);
      if (isNaN(count) || count < 1) {
        count = 1;
      }
    }
  } else if (command === 'range' && args.length > 2) {
    // Handle range command - will be implemented below
    const startId = parseInt(args[1]);
    const endId = parseInt(args[2]);
    if (isNaN(startId) || isNaN(endId)) {
      console.error('Invalid range. Please provide valid numbers.');
      return;
    }
    // Range will be handled separately below
  } else if (command && !isNaN(parseInt(command))) {
    // If first arg is just a number, treat it as a proposal ID
    proposalId = parseInt(command);
    // Check if there's an address to check
    if (args.length > 1 && args[1].startsWith('0x')) {
      checkAddress = args[1];
    }
  }

  // Handle the special case for range command
  if (command === 'range' && args.length > 2) {
    const startId = parseInt(args[1]);
    const endId = parseInt(args[2]);
    console.log(`Fetching proposals in range: ${startId} to ${endId}`);
    await fetchProposalRange(startId, endId);
    return;
  }

  console.log(
    proposalId === null
      ? `Fetching the ${
          count > 1 ? count + ' most recent' : 'latest'
        } proposal(s)...`
      : `Fetching proposal ID: ${proposalId}...`,
  );

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Try multiple contract addresses if needed
  const contractAddresses = [
    process.env.DAO_PROPOSALS_ADDRESS,
    '0xaC840F8A96EC6A6f9FbfdAae8daF8d9D679fd48B', // Default address
    '0x9C0563DAc7fa73875aEf56807782CCC7dE8df65b', // Address from error message
  ].filter(Boolean) as string[]; // Remove undefined/null entries

  // Remove duplicates
  const uniqueAddresses = [...new Set(contractAddresses)];

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

  // Try each contract address until one works
  let daoProposals: ethers.Contract | null = null;
  let workingAddress: string | null = null;

  for (const address of uniqueAddresses) {
    console.log(`Trying DAO Proposals contract at: ${address}`);
    const contract = new ethers.Contract(address, daoProposalsAbi, wallet);

    try {
      // Try a simple call to see if the contract is valid
      await contract.getProposalCore(1).catch(() => {
        // Intentionally empty - this is just a validation attempt
      });
      daoProposals = contract;
      workingAddress = address;
      console.log(`Successfully connected to DAO Proposals at: ${address}`);
      break;
    } catch (error) {
      console.log(
        `Could not validate contract at ${address}, trying next address...`,
      );
    }
  }

  if (!daoProposals || !workingAddress) {
    console.error(
      `Could not connect to any DAO Proposals contract. Please check the addresses.`,
    );
    return;
  }

  try {
    // If a specific proposal ID was provided, just fetch that one
    if (proposalId !== null) {
      await fetchAndDisplayProposal(
        daoProposals,
        wallet.address,
        proposalId,
        checkAddress,
      );
      return;
    }

    // Get the latest proposal ID - with fallback mechanisms
    console.log('Fetching latest proposal ID...');
    const latestProposalId = await getLatestProposalIdWithFallback(
      daoProposals,
    );
    console.log(`Latest proposal ID: ${latestProposalId}`);

    if (latestProposalId === 0) {
      console.log(
        'No proposals have been created yet or could not determine the latest ID.',
      );
      return;
    }

    if (count === 1) {
      // Just get the latest proposal
      await fetchAndDisplayProposal(
        daoProposals,
        wallet.address,
        latestProposalId,
      );
    } else {
      // Get multiple recent proposals
      console.log(`\nFetching the ${count} most recent proposals:`);

      // Calculate the start ID (make sure we don't go below 1)
      const startId = Math.max(1, latestProposalId - count + 1);

      // Fetch each proposal
      for (let id = latestProposalId; id >= startId; id--) {
        console.log(`\n----- PROPOSAL ${id} -----`);
        try {
          const proposalData = await daoProposals.getProposalCore(id);

          // Fetch voters
          let yesVoters: string[] = [];
          let noVoters: string[] = [];
          try {
            const voters = await daoProposals.getProposalVoters(id);
            yesVoters = voters.yesVoters;
            noVoters = voters.noVoters;
          } catch (error) {
            console.log('Could not fetch voter lists for this proposal');
          }

          displayProposalInfo(id, proposalData, yesVoters, noVoters);

          if (wallet.address !== ethers.ZeroAddress) {
            const userVoted = await daoProposals.hasVoted(id, wallet.address);
            console.log(`\nYour address: ${wallet.address}`);
            console.log(
              `You have ${userVoted ? '' : 'not '}voted on this proposal`,
            );
          }
        } catch (error) {
          console.error(`Error fetching proposal ${id}:`, error);
          console.log(`Could not load proposal ${id}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nSomething went wrong. Check the error above for details.');
    console.log('\nIf you know the proposal ID, try specifying it directly:');
    console.log('  ts-node get-proposal-data.ts 123');
  }
}

// Helper function to fetch a proposal range
async function fetchProposalRange(
  startId: number,
  endId: number,
): Promise<void> {
  // Similar implementation to the main function, but specifically for range
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Initialize wallet (same as in main function)
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

  // Try multiple contract addresses
  const contractAddresses = [
    process.env.DAO_PROPOSALS_ADDRESS,
    '0xaC840F8A96EC6A6f9FbfdAae8daF8d9D679fd48B',
    '0x9C0563DAc7fa73875aEf56807782CCC7dE8df65b',
  ].filter(Boolean) as string[];
  const uniqueAddresses = [...new Set(contractAddresses)];

  // Try each contract address
  let daoProposals: ethers.Contract | null = null;
  for (const address of uniqueAddresses) {
    console.log(`Trying DAO Proposals contract at: ${address}`);
    const contract = new ethers.Contract(address, daoProposalsAbi, wallet);

    try {
      await contract.getProposalCore(startId).catch(() => {
        // Intentionally empty - this is just a validation attempt
      });
      daoProposals = contract;
      console.log(`Successfully connected to DAO Proposals at: ${address}`);
      break;
    } catch (error) {
      console.log(
        `Could not validate contract at ${address}, trying next address...`,
      );
    }
  }

  if (!daoProposals) {
    console.error(
      `Could not connect to any DAO Proposals contract. Please check the addresses.`,
    );
    return;
  }

  // Fetch each proposal in the range
  for (let id = startId; id <= endId; id++) {
    console.log(`\n----- PROPOSAL ${id} -----`);
    try {
      const proposalData = await daoProposals.getProposalCore(id);

      // Fetch voters
      let yesVoters: string[] = [];
      let noVoters: string[] = [];
      try {
        const voters = await daoProposals.getProposalVoters(id);
        yesVoters = voters.yesVoters;
        noVoters = voters.noVoters;
      } catch (error) {
        console.log('Could not fetch voter lists for this proposal');
      }

      displayProposalInfo(id, proposalData, yesVoters, noVoters);

      if (wallet.address !== ethers.ZeroAddress) {
        const userVoted = await daoProposals.hasVoted(id, wallet.address);
        console.log(`\nYour address: ${wallet.address}`);
        console.log(
          `You have ${userVoted ? '' : 'not '}voted on this proposal`,
        );
      }
    } catch (error) {
      console.log(`Could not load proposal ${id}`);
    }
  }
}

// Helper function to fetch and display a single proposal
async function fetchAndDisplayProposal(
  contract: ethers.Contract,
  userAddress: string,
  proposalId: number,
  checkAddress: string | null = null,
): Promise<void> {
  try {
    console.log(`\nFetching details for proposal ID: ${proposalId}...`);
    const proposalData = await contract.getProposalCore(proposalId);

    // Fetch voters
    let yesVoters: string[] = [];
    let noVoters: string[] = [];
    try {
      const voters = await contract.getProposalVoters(proposalId);
      yesVoters = voters.yesVoters;
      noVoters = voters.noVoters;
    } catch (error) {
      console.log('Could not fetch voter lists for this proposal');
    }

    displayProposalInfo(proposalId, proposalData, yesVoters, noVoters);

    // Check if the user has voted on this proposal
    if (userAddress !== ethers.ZeroAddress) {
      const userVoted = await contract.hasVoted(proposalId, userAddress);
      console.log(`\nYour address: ${userAddress}`);
      console.log(`You have ${userVoted ? '' : 'not '}voted on this proposal`);
    }

    // Check if a specific address has voted
    if (checkAddress && checkAddress !== userAddress) {
      const addressVoted = await contract.hasVoted(proposalId, checkAddress);
      console.log(`\nChecked address: ${checkAddress}`);
      console.log(
        `This address has ${addressVoted ? '' : 'not '}voted on this proposal`,
      );
    }
  } catch (error) {
    console.error('Error fetching proposal data:', error);
    console.log(`\nProposal ID ${proposalId} does not exist or is invalid.`);
  }
}

// Run the script
getProposalData().catch(console.error);
