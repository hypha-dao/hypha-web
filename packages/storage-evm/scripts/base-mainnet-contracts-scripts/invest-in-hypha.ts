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
  investInHypha: (usdcAmount: bigint) => Promise<ContractTransactionWithWait>;
  balanceOf: (account: string) => Promise<bigint>;
  HYPHA_PRICE_USD: () => Promise<bigint>;
}

interface USDCInterface {
  balanceOf: (account: string) => Promise<bigint>;
  approve: (
    spender: string,
    amount: bigint,
  ) => Promise<ContractTransactionWithWait>;
  allowance: (owner: string, spender: string) => Promise<bigint>;
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
        internalType: 'uint256',
        name: 'usdcAmount',
        type: 'uint256',
      },
    ],
    name: 'investInHypha',
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
    name: 'HYPHA_PRICE_USD',
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

const usdcAbi = [
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
    inputs: [
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
    ],
    name: 'allowance',
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

  // Contract addresses
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC

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

  // Get contract instances
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  ) as ethers.Contract & HyphaTokenInterface;

  const usdc = new ethers.Contract(
    usdcAddress,
    usdcAbi,
    wallet,
  ) as ethers.Contract & USDCInterface;

  // Investment parameters
  const usdcAmount = ethers.parseUnits('1', 6); // 1 USDC with 6 decimals

  console.log('Investment Details:');
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}`);
  console.log(`USDC Contract: ${usdcAddress}`);
  console.log(`USDC Amount: ${ethers.formatUnits(usdcAmount, 6)} USDC`);
  console.log();

  try {
    // Check user's USDC balance first
    const usdcBalance = await usdc.balanceOf(wallet.address);
    console.log(
      `Your current USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`,
    );

    if (usdcBalance < usdcAmount) {
      throw new Error(
        `Insufficient USDC balance. Required: ${ethers.formatUnits(
          usdcAmount,
          6,
        )} USDC, Available: ${ethers.formatUnits(usdcBalance, 6)} USDC`,
      );
    }

    // Check current HYPHA balance
    const currentHyphaBalance = await hyphaToken.balanceOf(wallet.address);
    console.log(
      `Your current HYPHA balance: ${ethers.formatEther(
        currentHyphaBalance,
      )} HYPHA`,
    );

    // Get HYPHA price to calculate expected tokens
    try {
      const hyphaPrice = await hyphaToken.HYPHA_PRICE_USD();
      console.log(`HYPHA price (internal): ${hyphaPrice.toString()}`);

      // Calculate expected HYPHA tokens (based on contract logic: 4 × 10^12 scaling factor for $0.25 per HYPHA)
      const expectedHypha =
        (usdcAmount * BigInt(4) * BigInt(10) ** BigInt(12)) / hyphaPrice;
      console.log(
        `Expected HYPHA tokens: ~${ethers.formatEther(expectedHypha)} HYPHA`,
      );
    } catch (error) {
      console.log('Could not fetch HYPHA price');
    }

    // Check current allowance
    const currentAllowance = await usdc.allowance(
      wallet.address,
      hyphaTokenAddress,
    );
    console.log(
      `Current USDC allowance: ${ethers.formatUnits(
        currentAllowance,
        6,
      )} USDC\n`,
    );

    // Approve USDC if needed
    if (currentAllowance < usdcAmount) {
      console.log('Approving USDC spending...');
      const approveTx = await usdc.approve(hyphaTokenAddress, usdcAmount);
      console.log(`Approval transaction sent: ${approveTx.hash}`);
      console.log('Waiting for approval confirmation...');
      await approveTx.wait();
      console.log('✅ USDC approval confirmed!\n');
    } else {
      console.log('✅ Sufficient USDC allowance already exists\n');
    }

    console.log('Initiating HYPHA investment...');

    const tx = await hyphaToken.investInHypha(usdcAmount);

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Investment successful!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Check updated balances
    const newUsdcBalance = await usdc.balanceOf(wallet.address);
    const newHyphaBalance = await hyphaToken.balanceOf(wallet.address);

    console.log(
      `Updated USDC balance: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`,
    );
    console.log(
      `Updated HYPHA balance: ${ethers.formatEther(newHyphaBalance)} HYPHA`,
    );
    console.log(
      `USDC spent: ${ethers.formatUnits(usdcBalance - newUsdcBalance, 6)} USDC`,
    );
    console.log(
      `HYPHA received: ${ethers.formatEther(
        newHyphaBalance - currentHyphaBalance,
      )} HYPHA`,
    );
  } catch (error: any) {
    console.error('❌ Investment failed:', error.message);

    // Provide helpful error context
    if (error.message.includes('Insufficient USDC balance')) {
      console.log(
        '\n💡 Tip: You need more USDC tokens to make this investment.',
      );
    } else if (error.message.includes('transfer amount exceeds allowance')) {
      console.log(
        '\n💡 Tip: USDC allowance is insufficient. The script should handle this automatically.',
      );
    } else if (error.message.includes('MainHypha address not set')) {
      console.log(
        '\n💡 Tip: The contract needs to have the MainHypha address configured.',
      );
    } else if (error.message.includes('Exceeds max token supply')) {
      console.log(
        '\n💡 Tip: The investment would exceed the maximum HYPHA token supply.',
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
