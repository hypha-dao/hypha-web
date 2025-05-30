import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Add interface definitions
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

interface OwnershipTokenFactoryInterface {
  setVotingPowerContract: (
    votingPowerContract: string,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
}

interface OwnershipTokenVotingPowerInterface {
  setOwnershipTokenFactory: (
    tokenFactory: string,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
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
    OwnershipTokenFactory:
      /OwnershipTokenFactory proxy deployed to: (0x[a-fA-F0-9]{40})/,
    OwnershipTokenVotingPowerImplementation:
      /OwnershipTokenVotingPowerImplementation proxy deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const ownershipTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_votingPowerContract',
        type: 'address',
      },
    ],
    name: 'setVotingPowerContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
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

const ownershipTokenVotingPowerAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenFactory',
        type: 'address',
      },
    ],
    name: 'setOwnershipTokenFactory',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
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

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Check if OwnershipTokenFactory address is available
  if (!addresses['OwnershipTokenFactory']) {
    throw new Error('OwnershipTokenFactory address not found in addresses.txt');
  }

  // Check if OwnershipTokenVotingPowerImplementation address is available
  if (!addresses['OwnershipTokenVotingPowerImplementation']) {
    console.warn(
      'Warning: OwnershipTokenVotingPowerImplementation address not found in addresses.txt',
    );
    console.warn(
      'Please add the deployed OwnershipTokenVotingPowerImplementation proxy address to addresses.txt',
    );
    console.warn(
      'Format: OwnershipTokenVotingPowerImplementation proxy deployed to: <address>',
    );
    throw new Error(
      'OwnershipTokenVotingPowerImplementation address not found',
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('Configuring ownership token contracts...');
  console.log('Wallet address:', wallet.address);
  console.log(
    'OwnershipTokenFactory address:',
    addresses['OwnershipTokenFactory'],
  );
  console.log(
    'OwnershipTokenVotingPowerImplementation address:',
    addresses['OwnershipTokenVotingPowerImplementation'],
  );

  // Get contract instances
  const ownershipTokenFactory = new ethers.Contract(
    addresses['OwnershipTokenFactory'],
    ownershipTokenFactoryAbi,
    wallet,
  ) as ethers.Contract & OwnershipTokenFactoryInterface;

  const ownershipTokenVotingPower = new ethers.Contract(
    addresses['OwnershipTokenVotingPowerImplementation'],
    ownershipTokenVotingPowerAbi,
    wallet,
  ) as ethers.Contract & OwnershipTokenVotingPowerInterface;

  // Check ownership of both contracts
  console.log('\nChecking contract ownership...');

  const factoryOwner = await ownershipTokenFactory.owner();
  if (factoryOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the OwnershipTokenFactory contract.`,
    );
    console.error(`The owner is: ${factoryOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setVotingPowerContract',
    );
  }
  console.log('✓ You are the owner of OwnershipTokenFactory');

  const votingPowerOwner = await ownershipTokenVotingPower.owner();
  if (votingPowerOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the OwnershipTokenVotingPowerImplementation contract.`,
    );
    console.error(`The owner is: ${votingPowerOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setOwnershipTokenFactory',
    );
  }
  console.log('✓ You are the owner of OwnershipTokenVotingPowerImplementation');

  try {
    // Step 1: Set voting power contract in OwnershipTokenFactory
    console.log(
      '\n1. Setting voting power contract in OwnershipTokenFactory...',
    );
    const tx1 = await ownershipTokenFactory.setVotingPowerContract(
      addresses['OwnershipTokenVotingPowerImplementation'],
    );
    console.log('Transaction sent, waiting for confirmation...');
    await tx1.wait();
    console.log(
      '✓ Voting power contract set successfully in OwnershipTokenFactory!',
    );

    // Step 2: Set ownership token factory in OwnershipTokenVotingPowerImplementation
    console.log(
      '\n2. Setting ownership token factory in OwnershipTokenVotingPowerImplementation...',
    );
    const tx2 = await ownershipTokenVotingPower.setOwnershipTokenFactory(
      addresses['OwnershipTokenFactory'],
    );
    console.log('Transaction sent, waiting for confirmation...');
    await tx2.wait();
    console.log(
      '✓ Ownership token factory set successfully in OwnershipTokenVotingPowerImplementation!',
    );

    console.log('\n🎉 All contracts configured successfully!');
    console.log('The contracts are now properly linked and ready to use.');
  } catch (error: any) {
    console.error('Error configuring contracts:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
