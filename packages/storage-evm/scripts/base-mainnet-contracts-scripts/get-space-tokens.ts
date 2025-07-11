import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// ABI for the spaceTokens getter function from TokenVotingPowerStorage
const spaceTokensAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'spaceTokens',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// DAOSpaceFactory ABI to get space details and count
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
];

// Helper function to check if an address is the zero address
function isZeroAddress(address: string): boolean {
  return address === ethers.ZeroAddress;
}

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

async function getLatestSpaceIdWithFallback(
  contract: ethers.Contract,
): Promise<number> {
  try {
    // Try getting spaceCounter
    return Number(await contract.spaceCounter());
  } catch (error) {
    console.log('Could not call spaceCounter, using fallback method...');
    // Binary search fallback similar to get-space-data.ts
    let low = 1;
    let high = 1000;

    // Find an upper bound
    while (true) {
      try {
        await contract.getSpaceDetails(high);
        low = high;
        high = high * 2;
      } catch (error) {
        break;
      }
    }

    // Binary search
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      try {
        await contract.getSpaceDetails(mid);
        low = mid;
      } catch (error) {
        high = mid;
      }
    }

    return low;
  }
}

async function checkSpaceTokensInContract(
  contract: ethers.Contract,
  contractName: string,
  contractAddress: string,
  spaceIds: number[],
): Promise<{ [spaceId: number]: string }> {
  const results: { [spaceId: number]: string } = {};

  console.log(`\n🔍 Checking ${contractName} (${contractAddress}):`);

  // First, test if this contract has the spaceTokens function
  try {
    await contract.spaceTokens(1);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (
      errorMessage.includes('function selector was not recognized') ||
      errorMessage.includes('is not a function') ||
      errorMessage.includes('does not exist')
    ) {
      console.log(
        `  ⚠️  This contract does not have spaceTokens function (${contractName} uses different voting mechanism)`,
      );
      return results;
    }
  }

  for (const spaceId of spaceIds) {
    try {
      const tokenAddress = await contract.spaceTokens(spaceId);
      results[spaceId] = tokenAddress;

      if (!isZeroAddress(tokenAddress)) {
        console.log(`  Space ${spaceId}: ${tokenAddress} ✅`);
      } else {
        console.log(`  Space ${spaceId}: ${tokenAddress} ❌`);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('function selector was not recognized') ||
        errorMessage.includes('is not a function')
      ) {
        console.log(`  ⚠️  Contract does not support spaceTokens function`);
        break; // No point checking other space IDs
      } else {
        console.log(`  Space ${spaceId}: Network/RPC error ⚠️`);
        results[spaceId] = 'ERROR';
      }
    }
  }

  return results;
}

async function readSpaceTokens(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  let spaceId: number | null = null;
  let startId: number | null = null;
  let endId: number | null = null;
  let showAll = false;
  let specificContract: string | null = null;

  // Parse command line arguments
  if (command === 'id' && args.length > 1) {
    // Get specific space token by ID
    spaceId = parseInt(args[1]);
    if (isNaN(spaceId)) {
      console.error('Invalid space ID. Please provide a valid number.');
      return;
    }
  } else if (command === 'range' && args.length > 2) {
    // Handle range command
    startId = parseInt(args[1]);
    endId = parseInt(args[2]);
    if (isNaN(startId) || isNaN(endId)) {
      console.error('Invalid range. Please provide valid numbers.');
      return;
    }
  } else if (command === 'all') {
    showAll = true;
  } else if (command === 'contract' && args.length > 1) {
    // Check specific contract address
    specificContract = args[1];
    if (args.length > 2) {
      spaceId = parseInt(args[2]);
    }
  } else if (command && !isNaN(parseInt(command))) {
    // If first arg is just a number, treat it as a space ID
    spaceId = parseInt(command);
  }

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Initialize wallet (read-only, so we can use a dummy wallet)
  let wallet;
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      wallet = new ethers.Wallet(cleanPrivateKey, provider);
    } else {
      wallet = ethers.Wallet.createRandom().connect(provider);
    }
  } catch (error) {
    console.error('Error setting up wallet:', error);
    return;
  }

  // Contract addresses from addresses.txt - only token-based voting power contracts
  const votingPowerContracts = [
    {
      name: 'TokenVotingPower',
      address:
        process.env.TOKEN_VOTING_POWER_ADDRESS ||
        '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE',
    },
    // SpaceVotingPower is excluded because it's membership-based, not token-based
    // {
    //   name: 'SpaceVotingPower',
    //   address:
    //     process.env.SPACE_VOTING_POWER_ADDRESS ||
    //     '0x87537f0B5B8f34D689d484E743e83F82636E14a7',
    // },
    {
      name: 'VoteDecayTokenVotingPower',
      address:
        process.env.VOTE_DECAY_VOTING_POWER_ADDRESS ||
        '0x6dB5E05B21c68550B63a7404a3B68F81c159DAee',
    },
    {
      name: 'OwnershipTokenVotingPower',
      address:
        process.env.OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS ||
        '0x255c7b5DaC3696199fEF7A8CC6Cc87190bc36eFd',
    },
  ];

  // Remove the conditional check since we now have the address by default
  // if (process.env.OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS) {
  //   votingPowerContracts.push({
  //     name: 'OwnershipTokenVotingPower',
  //     address: process.env.OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS,
  //   });
  // }

  const DAO_SPACE_FACTORY_ADDRESS =
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
    '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

  console.log(
    `Using DAOSpaceFactory contract at: ${DAO_SPACE_FACTORY_ADDRESS}`,
  );
  console.log('\nVoting Power Contracts to check:');
  votingPowerContracts.forEach((contract) => {
    console.log(`  - ${contract.name}: ${contract.address}`);
  });

  // Initialize DAO Space Factory contract
  const daoSpaceFactoryContract = new ethers.Contract(
    DAO_SPACE_FACTORY_ADDRESS,
    daoSpaceFactoryAbi,
    wallet,
  );

  try {
    // If a specific contract address was provided
    if (specificContract) {
      console.log(`\nChecking specific contract: ${specificContract}`);
      const contract = new ethers.Contract(
        specificContract,
        spaceTokensAbi,
        wallet,
      );

      if (spaceId !== null) {
        const tokenAddress = await contract.spaceTokens(spaceId);
        console.log('========== SPACE TOKEN RESULT ==========');
        console.log(`Contract: ${specificContract}`);
        console.log(`Space ID: ${spaceId}`);
        console.log(`Token Address: ${tokenAddress}`);
        console.log(`Has Token: ${!isZeroAddress(tokenAddress)}`);
      } else {
        // Check latest few spaces for specific contract
        const latestSpaceId = await getLatestSpaceIdWithFallback(
          daoSpaceFactoryContract,
        );
        const spaceIds = Array.from(
          { length: Math.min(5, latestSpaceId) },
          (_, i) => latestSpaceId - i,
        );
        await checkSpaceTokensInContract(
          contract,
          'Custom Contract',
          specificContract,
          spaceIds,
        );
      }
      return;
    }

    // If a specific space ID was provided
    if (spaceId !== null) {
      console.log(
        `\n🔍 Checking space token for space ID: ${spaceId} across all contracts`,
      );
      console.log('========== SPACE TOKEN RESULTS ==========');

      for (const contractInfo of votingPowerContracts) {
        try {
          const contract = new ethers.Contract(
            contractInfo.address,
            spaceTokensAbi,
            wallet,
          );
          const tokenAddress = await contract.spaceTokens(spaceId);

          console.log(`\n${contractInfo.name} (${contractInfo.address}):`);
          console.log(`  Space ID: ${spaceId}`);
          console.log(`  Token Address: ${tokenAddress}`);
          console.log(
            `  Has Token: ${!isZeroAddress(tokenAddress)} ${
              !isZeroAddress(tokenAddress) ? '✅' : '❌'
            }`,
          );
        } catch (error) {
          console.log(`\n${contractInfo.name} (${contractInfo.address}):`);
          console.log(`  Space ID: ${spaceId}`);
          console.log(`  Error: Could not read from this contract ⚠️`);
        }
      }
      return;
    }

    // Get the latest space ID to determine range
    console.log('Fetching latest space ID...');
    const latestSpaceId = await getLatestSpaceIdWithFallback(
      daoSpaceFactoryContract,
    );
    console.log(`Latest space ID: ${latestSpaceId}`);

    if (latestSpaceId === 0) {
      console.log('No spaces found.');
      return;
    }

    let spaceIds: number[];

    // Determine which spaces to check
    if (startId !== null && endId !== null) {
      spaceIds = Array.from(
        { length: endId - startId + 1 },
        (_, i) => startId + i,
      );
      console.log(`\nChecking space tokens for range: ${startId} to ${endId}`);
    } else if (showAll || !command) {
      spaceIds = Array.from({ length: latestSpaceId }, (_, i) => i + 1);
      console.log(
        `\nChecking space tokens for all spaces (1 to ${latestSpaceId}):`,
      );
    } else {
      // Default: show just the latest few spaces
      const count = 5;
      const startFromId = Math.max(1, latestSpaceId - count + 1);
      spaceIds = Array.from({ length: count }, (_, i) => startFromId + i);
      console.log(
        `\nChecking space tokens for the last ${count} spaces (${startFromId} to ${latestSpaceId}):`,
      );
    }

    // Check all voting power contracts
    const allResults: {
      [contractName: string]: { [spaceId: number]: string };
    } = {};

    for (const contractInfo of votingPowerContracts) {
      try {
        const contract = new ethers.Contract(
          contractInfo.address,
          spaceTokensAbi,
          wallet,
        );
        const results = await checkSpaceTokensInContract(
          contract,
          contractInfo.name,
          contractInfo.address,
          spaceIds,
        );
        allResults[contractInfo.name] = results;
      } catch (error) {
        console.log(
          `\n❌ Could not connect to ${contractInfo.name} (${contractInfo.address})`,
        );
        allResults[contractInfo.name] = {};
      }
    }

    // Summary
    console.log('\n========== SUMMARY ==========');
    console.log(`Total spaces checked: ${spaceIds.length}`);

    for (const contractName of Object.keys(allResults)) {
      const results = allResults[contractName];
      const spacesWithTokens = Object.values(results).filter(
        (addr) => addr !== 'ERROR' && !isZeroAddress(addr),
      ).length;
      const spacesWithErrors = Object.values(results).filter(
        (addr) => addr === 'ERROR',
      ).length;

      console.log(`\n${contractName}:`);
      console.log(`  Spaces with tokens: ${spacesWithTokens}`);
      console.log(`  Spaces with errors: ${spacesWithErrors}`);

      if (spacesWithTokens > 0) {
        const spacesWithTokensList = Object.keys(results).filter(
          (spaceId) =>
            results[parseInt(spaceId)] !== 'ERROR' &&
            !isZeroAddress(results[parseInt(spaceId)]),
        );
        console.log(
          `  Space IDs with tokens: ${spacesWithTokensList.join(', ')}`,
        );
      }
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nSomething went wrong. Check the error above for details.');
  }
}

// Display usage information
function displayUsage() {
  console.log('Usage:');
  console.log(
    '  ts-node get-space-tokens.ts                         # Show last 5 spaces across token-based contracts',
  );
  console.log(
    '  ts-node get-space-tokens.ts all                     # Show all spaces across token-based contracts',
  );
  console.log(
    '  ts-node get-space-tokens.ts id <spaceId>            # Show specific space across token-based contracts',
  );
  console.log(
    '  ts-node get-space-tokens.ts <spaceId>               # Show specific space (shorthand)',
  );
  console.log(
    '  ts-node get-space-tokens.ts range <start> <end>     # Show range of spaces across token-based contracts',
  );
  console.log(
    '  ts-node get-space-tokens.ts contract <address>      # Check specific contract for latest spaces',
  );
  console.log(
    '  ts-node get-space-tokens.ts contract <address> <id> # Check specific contract for specific space',
  );
  console.log('');
  console.log('Examples:');
  console.log('  ts-node get-space-tokens.ts 123');
  console.log('  ts-node get-space-tokens.ts id 123');
  console.log('  ts-node get-space-tokens.ts range 1 10');
  console.log('  ts-node get-space-tokens.ts all');
  console.log('  ts-node get-space-tokens.ts contract 0x1234...abcd');
  console.log('  ts-node get-space-tokens.ts contract 0x1234...abcd 123');
  console.log('');
  console.log(
    'Note: Only token-based voting power contracts are checked by default.',
  );
  console.log(
    'SpaceVotingPower is excluded as it uses membership-based voting, not tokens.',
  );
  console.log('');
  console.log('Token-based Voting Power Contracts:');
  console.log(
    '  TOKEN_VOTING_POWER_ADDRESS         - Default: 0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE',
  );
  console.log(
    '  VOTE_DECAY_VOTING_POWER_ADDRESS    - Default: 0x6dB5E05B21c68550B63a7404a3B68F81c159DAee',
  );
  console.log(
    '  OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS - Default: 0x255c7b5DaC3696199fEF7A8CC6Cc87190bc36eFd',
  );
  console.log('');
  console.log('Other Environment Variables:');
  console.log(
    '  DAO_SPACE_FACTORY_ADDRESS          - Default: 0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
  );
  console.log('');
  console.log(
    'Membership-based Contract (use contract command to check manually):',
  );
  console.log(
    '  SPACE_VOTING_POWER_ADDRESS         - 0x87537f0B5B8f34D689d484E743e83F82636E14a7',
  );
}

// Check if help was requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  displayUsage();
  process.exit(0);
}

// Run the script
readSpaceTokens().catch(console.error);
