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

interface HyphaTokenInterface {
  setDestinationAddresses: (
    iexAddress: string,
    mainHyphaAddress: string,
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
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const hyphaTokenAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_iexAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_mainHyphaAddress',
        type: 'address',
      },
    ],
    name: 'setDestinationAddresses',
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
      'Usage: npm run set-destination-addresses <iexAddress> <mainHyphaAddress>',
    );
    console.error(
      'Example: npm run set-destination-addresses 0x1234567890123456789012345678901234567890 0x0987654321098765432109876543210987654321',
    );
    process.exit(1);
  }

  const [iexAddress, mainHyphaAddress] = args;

  // Validate addresses
  if (!ethers.isAddress(iexAddress)) {
    throw new Error(`Invalid IEX address: ${iexAddress}`);
  }

  if (!ethers.isAddress(mainHyphaAddress)) {
    throw new Error(`Invalid mainHypha address: ${mainHyphaAddress}`);
  }

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify HyphaToken address is available
  if (!addresses['HyphaToken']) {
    throw new Error('Missing HyphaToken address in addresses.txt');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const hyphaTokenAddress = addresses['HyphaToken'];
  console.log('HyphaToken address from addresses.txt:', hyphaTokenAddress);

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  ) as ethers.Contract & HyphaTokenInterface;

  // Check if the wallet is the owner
  const contractOwner = await hyphaToken.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the HyphaToken contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setDestinationAddresses',
    );
  }

  console.log('Setting destination addresses with the following parameters:');
  console.log('IEX Address:', iexAddress);
  console.log('MainHypha Address:', mainHyphaAddress);

  try {
    const tx = await hyphaToken.setDestinationAddresses(
      iexAddress,
      mainHyphaAddress,
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Destination addresses set successfully!');
  } catch (error: any) {
    console.error('Error setting destination addresses:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
