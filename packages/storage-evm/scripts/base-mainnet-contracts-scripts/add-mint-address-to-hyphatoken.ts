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

interface HyphaTokenInterface {
  addMintAddress: (mintAddress: string) => Promise<ContractTransactionWithWait>;
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
        name: '_mintAddress',
        type: 'address',
      },
    ],
    name: 'addMintAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // The address to add as authorized minter
  const MINT_ADDRESS = '0x61F86dF4a0562Bba5EF3F289a2046cd724D80A8B';

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the HyphaToken address from environment or addresses file
  const hyphaTokenAddress =
    process.env.HYPHA_TOKEN_ADDRESS || addresses['HyphaToken'];

  if (!hyphaTokenAddress) {
    throw new Error('HyphaToken address is required but not found');
  }

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  ) as ethers.Contract & HyphaTokenInterface;

  console.log('Adding mint address with the following details:');
  console.log('HyphaToken Contract:', hyphaTokenAddress);
  console.log('Address to add as minter:', MINT_ADDRESS);

  try {
    const tx = await hyphaToken.addMintAddress(MINT_ADDRESS);

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Mint address added successfully!');
  } catch (error: any) {
    console.error('Error adding mint address:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
