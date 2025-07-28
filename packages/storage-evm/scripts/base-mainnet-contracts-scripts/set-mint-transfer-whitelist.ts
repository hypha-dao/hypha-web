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
  setMintTransferWhitelist: (
    account: string,
    status: boolean,
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
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'status',
        type: 'bool',
      },
    ],
    name: 'setMintTransferWhitelist',
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
      'Usage: npm run set-mint-transfer-whitelist <address> <status>',
    );
    console.error(
      'Example: npm run set-mint-transfer-whitelist 0x1234567890123456789012345678901234567890 true',
    );
    process.exit(1);
  }

  const [accountAddress, statusStr] = args;

  // Validate address
  if (!ethers.isAddress(accountAddress)) {
    throw new Error(`Invalid address: ${accountAddress}`);
  }

  // Validate and parse status
  const status = statusStr.toLowerCase() === 'true';
  if (
    statusStr.toLowerCase() !== 'true' &&
    statusStr.toLowerCase() !== 'false'
  ) {
    throw new Error(
      `Invalid status. Must be 'true' or 'false', got: ${statusStr}`,
    );
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
      'Permission denied: only the contract owner can call setMintTransferWhitelist',
    );
  }

  console.log('Setting mint transfer whitelist with the following parameters:');
  console.log('Account:', accountAddress);
  console.log('Status:', status);

  try {
    const tx = await hyphaToken.setMintTransferWhitelist(
      accountAddress,
      status,
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Mint transfer whitelist set successfully!');
  } catch (error: any) {
    console.error('Error setting mint transfer whitelist:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
