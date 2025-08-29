import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Function to parse addresses from addresses.txt
function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  // Extract VotingPowerDirectory address
  const patterns = {
    VotingPowerDirectory:
      /VotingPowerDirectory deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

// VotingPowerDirectoryImplementation ABI
const votingPowerDirectoryAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_sourceId',
        type: 'uint256',
      },
    ],
    name: 'getVotingPowerSourceContract',
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
  {
    inputs: [],
    name: 'sourceCounter',
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

async function fetchVotingPowerSources(): Promise<void> {
  console.log('Fetching voting power source contracts...');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data (for read-only operations, we don't need the private key, but keeping the structure)
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log(
      'accounts.json not found or invalid. Using environment variables.',
    );
  }

  // If no accounts from JSON, try to use environment variable
  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;

    if (privateKey) {
      console.log('Using private key from environment variable.');
      try {
        const cleanPrivateKey = privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey;

        const wallet = new ethers.Wallet(cleanPrivateKey);
        accountData = [
          {
            privateKey: cleanPrivateKey,
            address: wallet.address,
          },
        ];
      } catch (error) {
        console.error(
          'Invalid private key format in environment variable:',
          error,
        );
      }
    } else {
      console.error('PRIVATE_KEY not found in environment variables.');
    }
  }

  if (accountData.length === 0) {
    console.error(
      'No accounts found. Please create an accounts.json file or provide a valid PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // Parse addresses from file
  const addresses = parseAddressesFile();

  if (!addresses['VotingPowerDirectory']) {
    throw new Error('VotingPowerDirectory address not found in addresses.txt');
  }

  const votingPowerDirectoryAddress = addresses['VotingPowerDirectory'];
  console.log(`VotingPowerDirectory address: ${votingPowerDirectoryAddress}`);

  // Initialize contract
  const votingPowerDirectory = new ethers.Contract(
    votingPowerDirectoryAddress,
    votingPowerDirectoryAbi,
    wallet,
  );

  try {
    // First, get the current source counter to see how many sources exist
    console.log('\n=== Getting source counter ===');
    const sourceCounter = await votingPowerDirectory.sourceCounter();
    console.log(`Total sources registered: ${sourceCounter}`);

    // Fetch voting power source contracts for IDs 0, 1, 2, 3, 4, 5
    const idsToCheck = [0, 1, 2, 3, 4, 5];

    console.log('\n=== Fetching voting power source contracts ===');

    const results: { id: number; address: string | null; error?: string }[] =
      [];

    for (const id of idsToCheck) {
      try {
        console.log(`\nChecking source ID: ${id}`);
        const sourceAddress =
          await votingPowerDirectory.getVotingPowerSourceContract(id);
        console.log(`✅ Source ID ${id}: ${sourceAddress}`);
        results.push({ id, address: sourceAddress });
      } catch (error: any) {
        console.log(`❌ Source ID ${id}: ${error.message}`);
        results.push({ id, address: null, error: error.message });
      }
    }

    // Summary table
    console.log('\n=== Summary ===');
    console.log('ID | Address                                    | Status');
    console.log('---|--------------------------------------------|---------');

    results.forEach((result) => {
      const addressDisplay = result.address || 'N/A';
      const status = result.address ? 'Found' : 'Error';
      console.log(
        `${result.id.toString().padStart(2)} | ${addressDisplay.padEnd(
          42,
        )} | ${status}`,
      );
    });

    // Show valid sources with names (if we can identify them)
    console.log('\n=== Valid Sources ===');
    const validSources = results.filter((r) => r.address);

    if (validSources.length > 0) {
      console.log('The following voting power sources are registered:');
      validSources.forEach((source) => {
        let sourceName = 'Unknown';

        // Try to identify known contract addresses
        if (source.address === '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE') {
          sourceName = 'TokenVotingPowerImplementation';
        } else if (
          source.address === '0x87537f0B5B8f34D689d484E743e83F82636E14a7'
        ) {
          sourceName = 'SpaceVotingPowerImplementation';
        } else if (
          source.address === '0x6dB5E05B21c68550B63a7404a3B68F81c159DAee'
        ) {
          sourceName = 'VoteDecayTokenVotingPowerImplementation';
        } else if (
          source.address === '0x255c7b5DaC3696199fEF7A8CC6Cc87190bc36eFd'
        ) {
          sourceName = 'OwnershipTokenVotingPowerImplementation';
        }

        console.log(`- ID ${source.id}: ${sourceName} (${source.address})`);
      });
    } else {
      console.log(
        'No valid voting power sources found in the specified range.',
      );
    }
  } catch (error) {
    console.error('Error fetching voting power sources:', error);
  }
}

// Run the script
fetchVotingPowerSources().catch(console.error);
