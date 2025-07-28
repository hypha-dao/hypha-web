import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Add these interface definitions
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

interface SpacePaymentTrackerInterface {
  setAuthorizedContracts: (
    hyphaTokenAddress: string,
    proposalsAddress: string,
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
    SpacePaymentTracker: /SpacePaymentTracker deployed to: (0x[a-fA-F0-9]{40})/,
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
    DAOProposals: /DAOProposals deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const spacePaymentTrackerAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_hyphaTokenContract',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_proposalsContract',
        type: 'address',
      },
    ],
    name: 'setAuthorizedContracts',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify all required addresses are available
  const requiredContracts = ['HyphaToken', 'DAOProposals'];
  const missingContracts = requiredContracts.filter(
    (contract) => !addresses[contract],
  );

  if (missingContracts.length > 0) {
    throw new Error(`Missing addresses for: ${missingContracts.join(', ')}`);
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the SpacePaymentTracker address from environment or addresses file
  const spacePaymentTrackerAddress =
    process.env.SPACE_PAYMENT_TRACKER_ADDRESS ||
    addresses['SpacePaymentTracker'];

  if (!spacePaymentTrackerAddress) {
    throw new Error('SpacePaymentTracker address is required but not found');
  }

  // Get the SpacePaymentTracker contract instance
  const spacePaymentTracker = new ethers.Contract(
    spacePaymentTrackerAddress,
    spacePaymentTrackerAbi,
    wallet,
  ) as ethers.Contract & SpacePaymentTrackerInterface;

  console.log('Setting authorized contracts with the following addresses:');
  console.log('HyphaToken Contract:', addresses['HyphaToken']);
  console.log('Proposals Contract:', addresses['DAOProposals']);

  try {
    const tx = await spacePaymentTracker.setAuthorizedContracts(
      addresses['HyphaToken'],
      addresses['DAOProposals'],
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Authorized contracts set successfully!');
  } catch (error: any) {
    console.error('Error setting authorized contracts:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
