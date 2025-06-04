import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Interface definitions
interface Log {
  topics: string[];
  [key: string]: any;
}

interface TransactionReceipt {
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  wait(): Promise<TransactionReceipt>;
}

interface DAOSpaceFactoryInterface {
  getSpaceDetails: (spaceId: number) => Promise<{
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
  }>;
  changeVotingMethod: (
    spaceId: number,
    newVotingPowerSource: number,
    newUnity: number,
    newQuorum: number,
  ) => Promise<ContractTransactionWithWait>;
}

// Function to parse addresses from addresses.txt
function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  // Extract contract addresses using regex
  const patterns = {
    DAOSpaceFactory: /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
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
    inputs: [
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_newVotingPowerSource',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_newUnity',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_newQuorum',
        type: 'uint256',
      },
    ],
    name: 'changeVotingMethod',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Get spaceId from command line arguments
  const spaceId = process.argv[2];

  if (!spaceId) {
    console.error('Please provide a space ID as an argument');
    console.error('Usage: npm run change-voting-method <spaceId>');
    process.exit(1);
  }

  const spaceIdNumber = parseInt(spaceId);
  if (isNaN(spaceIdNumber) || spaceIdNumber <= 0) {
    console.error('Invalid space ID. Please provide a positive number.');
    process.exit(1);
  }

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the DAO Space Factory address from environment or addresses file
  const daoSpaceFactoryAddress =
    process.env.DAO_SPACE_FACTORY_ADDRESS || addresses['DAOSpaceFactory'];

  if (!daoSpaceFactoryAddress) {
    throw new Error('DAOSpaceFactory address is required but not found');
  }

  // Get the DAO Space Factory contract instance
  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  console.log(`Querying space details for space ID: ${spaceIdNumber}`);

  try {
    // Get current space details
    const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceIdNumber);

    const currentUnity = Number(spaceDetails.unity);
    const currentQuorum = Number(spaceDetails.quorum);
    const currentVotingPowerSource = Number(spaceDetails.votingPowerSource);

    console.log('Current space details:');
    console.log('  Unity:', currentUnity);
    console.log('  Quorum:', currentQuorum);
    console.log('  Voting Power Source:', currentVotingPowerSource);

    // Check if voting power source is already 2
    if (currentVotingPowerSource === 2) {
      console.log('Voting power source is already set to 2. No change needed.');
      return;
    }

    console.log('\nChanging voting method...');
    console.log('  New Voting Power Source: 2');
    console.log('  Unity (unchanged):', currentUnity);
    console.log('  Quorum (unchanged):', currentQuorum);

    // Call changeVotingMethod with votingPowerSource = 2 and existing unity/quorum
    const tx = await daoSpaceFactory.changeVotingMethod(
      spaceIdNumber,
      2, // New voting power source
      currentUnity,
      currentQuorum,
    );

    console.log('Transaction sent, waiting for confirmation...');
    console.log('Transaction hash:', tx.hash);

    await tx.wait();
    console.log('Voting method changed successfully!');
  } catch (error: any) {
    console.error('Error changing voting method:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
