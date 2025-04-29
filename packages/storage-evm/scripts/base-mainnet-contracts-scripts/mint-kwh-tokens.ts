import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Interface for transaction receipt
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

// Interface for KWH Token
interface KWHERC20Interface {
  mint: (
    kwh: ethers.BigNumberish,
    timestamp: ethers.BigNumberish,
    deviceId: string,
  ) => Promise<ContractTransactionWithWait>;
}

// ABI for the KWH ERC20 Contract's mint function
const kwhERC20Abi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'kwh',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'deviceId',
        type: 'address',
      },
    ],
    name: 'mint',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        internalType: 'uint8',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// Function to parse addresses from addresses.txt
function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );

  // Create a default empty object if file doesn't exist
  if (!fs.existsSync(addressesPath)) {
    return {};
  }

  const fileContent = fs.readFileSync(addressesPath, 'utf8');
  const addresses: Record<string, string> = {};

  // Extract contract addresses using regex
  const patterns = {
    KWHERC20: /KWH Token deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Get KWH Token address from environment variable or addresses file
  const kwhTokenAddress =
    process.env.KWH_TOKEN_ADDRESS || addresses['KWHERC20'];

  if (!kwhTokenAddress) {
    throw new Error(
      "KWH Token address is required but not found. Make sure it's in addresses.txt or set KWH_TOKEN_ADDRESS",
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  console.log(`Connected with wallet: ${wallet.address}`);

  // Get the KWH Token contract instance
  const kwhToken = new ethers.Contract(
    kwhTokenAddress,
    kwhERC20Abi,
    wallet,
  ) as ethers.Contract & KWHERC20Interface;

  // Create a random device ID (an address)
  const randomDeviceId = ethers.Wallet.createRandom().address;
  console.log(`Using random device ID: ${randomDeviceId}`);

  // Amount to mint: 11.1111 kWh with 4 decimals = 111111
  const kwhAmount = 111111; // 11.1111 with 4 decimals

  // Current timestamp in seconds
  const currentTimestamp = Math.floor(Date.now() / 1000);

  console.log(
    `Minting ${
      kwhAmount / 10000
    } kWh at timestamp ${currentTimestamp} from device ${randomDeviceId}`,
  );

  try {
    const tx = await kwhToken.mint(kwhAmount, currentTimestamp, randomDeviceId);

    console.log('Transaction sent, waiting for confirmation...');
    console.log(`Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();

    // Parse events from receipt
    if (receipt && receipt.logs) {
      console.log('Transaction confirmed!');

      // Try to find the TokenMinted event
      for (const log of receipt.logs) {
        if (
          log.topics[0] ===
          ethers.id('TokenMinted(uint256,uint256,uint256,address,address)')
        ) {
          console.log('Found TokenMinted event!');
          // You could decode the event data here if needed
        }
      }
    }

    console.log('KWH tokens minted successfully!');
  } catch (error: any) {
    console.error('Error minting KWH tokens:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
