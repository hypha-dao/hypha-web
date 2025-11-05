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

interface SpacePaymentTrackerInterface {
  setCustomExpiryTime: (
    spaceId: number,
    newExpiryTime: number,
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

const spacePaymentTrackerAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'newExpiryTime',
        type: 'uint256',
      },
    ],
    name: 'setCustomExpiryTime',
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
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error(
      'Usage: ts-node packages/storage-evm/scripts/base-mainnet-contracts-scripts/set-custom-expiry-time.ts <spaceId> <expiryDate>',
    );
    console.error(
      "Example: ts-node packages/storage-evm/scripts/base-mainnet-contracts-scripts/set-custom-expiry-time.ts 241 '22 October 2025'",
    );
    process.exit(1);
  }

  const [spaceIdStr, expiryDateStr] = args;
  const spaceId = parseInt(spaceIdStr, 10);
  const expiryTimestamp = Math.floor(new Date(expiryDateStr).getTime() / 1000);

  if (isNaN(spaceId)) {
    throw new Error(`Invalid space ID: ${spaceIdStr}`);
  }

  if (isNaN(expiryTimestamp)) {
    throw new Error(
      `Invalid date format: ${expiryDateStr}. Please use a format like '22 October 2025'`,
    );
  }

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify SpacePaymentTracker address is available
  if (!addresses['SpacePaymentTracker']) {
    throw new Error('Missing SpacePaymentTracker address in addresses.txt');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const spacePaymentTrackerAddress = addresses['SpacePaymentTracker'];
  console.log(
    'SpacePaymentTracker address from addresses.txt:',
    spacePaymentTrackerAddress,
  );

  // Get the SpacePaymentTracker contract instance
  const spacePaymentTracker = new ethers.Contract(
    spacePaymentTrackerAddress,
    spacePaymentTrackerAbi,
    wallet,
  ) as ethers.Contract & SpacePaymentTrackerInterface;

  // Check if the wallet is the owner
  const contractOwner = await spacePaymentTracker.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the SpacePaymentTracker contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setCustomExpiryTime',
    );
  }

  console.log('Setting custom expiry time with the following parameters:');
  console.log('Space ID:', spaceId);
  console.log('New Expiry Timestamp:', expiryTimestamp);

  try {
    const tx = await spacePaymentTracker.setCustomExpiryTime(
      spaceId,
      expiryTimestamp,
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Custom expiry time set successfully!');
  } catch (error: any) {
    console.error('Error setting custom expiry time:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
