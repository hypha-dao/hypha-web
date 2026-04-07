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

interface TokenVotingPowerInterface {
  setSpaceToken: (
    spaceId: bigint,
    tokenAddress: string,
  ) => Promise<ContractTransactionWithWait>;
  spaceTokens: (spaceId: bigint) => Promise<string>;
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
    TokenVotingPower: /TokenVotingPower deployed to: (0x[a-fA-F0-9]{40})/,
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

const tokenVotingPowerAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_tokenAddress',
        type: 'address',
      },
    ],
    name: 'setSpaceToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'spaceTokens',
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

  // Contract addresses
  const tokenVotingPowerAddress = '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE';
  const tokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3'; // HyphaToken
  const spaceId = 242;

  if (!ethers.isAddress(tokenVotingPowerAddress)) {
    throw new Error(
      `Invalid TokenVotingPower address: ${tokenVotingPowerAddress}`,
    );
  }

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
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

  // Get the TokenVotingPower contract instance
  const tokenVotingPower = new ethers.Contract(
    tokenVotingPowerAddress,
    tokenVotingPowerAbi,
    wallet,
  ) as ethers.Contract & TokenVotingPowerInterface;

  console.log('Set Space Token Details:');
  console.log(`TokenVotingPower Contract: ${tokenVotingPowerAddress}`);
  console.log(`Space ID: ${spaceId}`);
  console.log(`Token Address: ${tokenAddress} (HyphaToken)`);
  console.log();

  try {
    // Check current space token setting
    try {
      const currentToken = await tokenVotingPower.spaceTokens(BigInt(spaceId));
      console.log(`Current token for space ${spaceId}: ${currentToken}`);

      if (currentToken === tokenAddress) {
        console.log('✅ Token is already set to the desired address!');
        return;
      } else if (currentToken !== ethers.ZeroAddress) {
        console.log(
          `⚠️  Space ${spaceId} already has a different token set: ${currentToken}`,
        );
        console.log('Proceeding to update...');
      }
    } catch (error) {
      console.log('Could not fetch current space token setting');
    }

    console.log('\nInitiating setSpaceToken transaction...');

    const tx = await tokenVotingPower.setSpaceToken(
      BigInt(spaceId),
      tokenAddress,
    );

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Space token set successfully!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Verify the setting
    try {
      const newToken = await tokenVotingPower.spaceTokens(BigInt(spaceId));
      console.log(`\nVerification:`);
      console.log(`Space ${spaceId} token is now set to: ${newToken}`);

      if (newToken.toLowerCase() === tokenAddress.toLowerCase()) {
        console.log('✅ Token setting verified successfully!');
      } else {
        console.log('❌ Token setting verification failed!');
      }
    } catch (error) {
      console.log('Could not verify token setting');
    }
  } catch (error: any) {
    console.error('❌ Setting space token failed:', error.message);

    // Provide helpful error context
    if (error.message.includes('Only space executor can set space token')) {
      console.log(
        '\n💡 Tip: Only the space executor can set the space token. Make sure you are using the correct wallet.',
      );
    } else if (error.message.includes('Invalid space ID')) {
      console.log('\n💡 Tip: The space ID must be greater than 0.');
    } else if (error.message.includes('Invalid token address')) {
      console.log('\n💡 Tip: The token address cannot be the zero address.');
    } else if (error.message.includes('Space factory not set')) {
      console.log(
        '\n💡 Tip: The TokenVotingPower contract needs to have the space factory address configured.',
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
