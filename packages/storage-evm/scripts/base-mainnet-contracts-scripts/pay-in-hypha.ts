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
  hash: string;
  wait(): Promise<TransactionReceipt>;
}

interface HyphaTokenInterface {
  payInHypha: (
    spaceIds: number[],
    hyphaAmounts: bigint[],
  ) => Promise<ContractTransactionWithWait>;
  balanceOf: (account: string) => Promise<bigint>;
  HYPHA_PER_DAY: () => Promise<bigint>;
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
        internalType: 'uint256[]',
        name: 'spaceIds',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'hyphaAmounts',
        type: 'uint256[]',
      },
    ],
    name: 'payInHypha',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'balanceOf',
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
  {
    inputs: [],
    name: 'HYPHA_PER_DAY',
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

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Use the HyphaToken address from the provided address or addresses file
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  if (!ethers.isAddress(hyphaTokenAddress)) {
    throw new Error(`Invalid HyphaToken address: ${hyphaTokenAddress}`);
  }

  // Use environment RPC_URL if available, otherwise use reliable Base mainnet RPC
  const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';

  if (!process.env.RPC_URL) {
    console.log(
      `⚠️  RPC_URL not set in environment, using reliable Base mainnet RPC: ${rpcUrl}`,
    );
    console.log('   To use a custom RPC, set RPC_URL environment variable\n');
  } else {
    console.log(`Using configured RPC URL: ${rpcUrl}\n`);
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Create a wallet instance
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  // Clean the private key - handle both with and without 0x prefix
  const cleanPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;

  let wallet;
  try {
    wallet = new ethers.Wallet(cleanPrivateKey, provider);
  } catch (error) {
    throw new Error(
      `Invalid private key format. Please ensure PRIVATE_KEY is a valid 64-character hex string (with or without 0x prefix). Error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log(`Using wallet address: ${wallet.address}\n`);

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  ) as ethers.Contract & HyphaTokenInterface;

  // Payment parameters
  const spaceId = 241;
  const hyphaAmount = ethers.parseEther('44'); // 44 HYPHA with 18 decimals

  console.log('Payment Details:');
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}`);
  console.log(`Space ID: ${spaceId}`);
  console.log(`HYPHA Amount: ${ethers.formatEther(hyphaAmount)} HYPHA`);
  console.log();

  try {
    // Check user's HYPHA balance first
    const userBalance = await hyphaToken.balanceOf(wallet.address);
    console.log(
      `Your current HYPHA balance: ${ethers.formatEther(userBalance)} HYPHA`,
    );

    if (userBalance < hyphaAmount) {
      throw new Error(
        `Insufficient HYPHA balance. Required: ${ethers.formatEther(
          hyphaAmount,
        )} HYPHA, Available: ${ethers.formatEther(userBalance)} HYPHA`,
      );
    }

    // Get HYPHA_PER_DAY to show duration calculation
    try {
      const hyphaPerDay = await hyphaToken.HYPHA_PER_DAY();
      const durationInDays = hyphaAmount / hyphaPerDay;
      console.log(
        `HYPHA per day rate: ${ethers.formatEther(hyphaPerDay)} HYPHA`,
      );
      console.log(`Duration: ~${durationInDays} days\n`);
    } catch (error) {
      console.log('Could not fetch HYPHA_PER_DAY rate\n');
    }

    console.log('Initiating payment...');

    const tx = await hyphaToken.payInHypha([spaceId], [hyphaAmount]);

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Payment successful!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Check updated balance
    const newBalance = await hyphaToken.balanceOf(wallet.address);
    console.log(
      `Updated HYPHA balance: ${ethers.formatEther(newBalance)} HYPHA`,
    );
    console.log(
      `HYPHA used: ${ethers.formatEther(userBalance - newBalance)} HYPHA`,
    );
  } catch (error: any) {
    console.error('❌ Payment failed:', error.message);

    // Provide helpful error context
    if (error.message.includes('Insufficient HYPHA balance')) {
      console.log('\n💡 Tip: You need more HYPHA tokens to make this payment.');
    } else if (error.message.includes('Payment too small')) {
      console.log(
        '\n💡 Tip: The payment amount is too small. Minimum payment is for 1 day.',
      );
    } else if (error.message.includes('IEX address not set')) {
      console.log(
        '\n💡 Tip: The contract needs to have the IEX address configured.',
      );
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
