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
  hash: string;
  wait(): Promise<TransactionReceipt>;
}

interface DAOProposalsInterface {
  setPaymentTracker: (
    paymentTrackerAddress: string,
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

  // Extract contract addresses using regex - updated to match your addresses.txt format
  const patterns = {
    DAOProposals: /DAOProposals deployed to: (0x[a-fA-F0-9]{40})/,
    SpacePaymentTracker: /SpacePaymentTracker deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const daoProposalsAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_paymentTracker',
        type: 'address',
      },
    ],
    name: 'setPaymentTracker',
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

  // Check if payment tracker address is provided via environment variable
  const paymentTrackerAddress =
    process.env.PAYMENT_TRACKER_ADDRESS || addresses['SpacePaymentTracker'];

  if (!paymentTrackerAddress) {
    throw new Error(
      'Payment tracker address not found. Please provide PAYMENT_TRACKER_ADDRESS environment variable or ensure SpacePaymentTracker is in addresses.txt',
    );
  }

  // Verify DAOProposals address is available
  if (!addresses['DAOProposals']) {
    throw new Error('DAOProposals address not found in addresses.txt');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the DAO Proposals address directly from addresses.txt
  const daoProposalsAddress = addresses['DAOProposals'];

  console.log('DAO Proposals address from addresses.txt:', daoProposalsAddress);
  console.log('Payment Tracker address:', paymentTrackerAddress);

  // Get the DAO Proposals contract instance
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  ) as ethers.Contract & DAOProposalsInterface;

  // Check if the wallet is the owner
  const contractOwner = await daoProposals.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the DAOProposals contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setPaymentTracker',
    );
  }

  console.log(
    'Setting payment tracker in DAOProposals with address:',
    paymentTrackerAddress,
  );

  try {
    const tx = await daoProposals.setPaymentTracker(paymentTrackerAddress);

    console.log('Transaction sent, waiting for confirmation...');
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
    console.log('Payment tracker set successfully in DAOProposals!');
  } catch (error: any) {
    console.error('Error setting payment tracker:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
