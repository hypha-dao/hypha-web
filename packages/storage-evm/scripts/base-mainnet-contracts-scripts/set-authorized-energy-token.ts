import dotenv from 'dotenv';
import { ethers } from 'ethers';

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

interface RegularSpaceTokenInterface {
  setAuthorized: (
    account: string,
    authorized: boolean,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
  authorized(address: string): Promise<boolean>;
}

// ABI for the RegularSpaceToken contract (only the functions we need)
const tokenAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_authorized',
        type: 'bool',
      },
    ],
    name: 'setAuthorized',
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
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'authorized',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      'Usage: ts-node set-authorized-energy-token.ts <address> <true|false>',
    );
    console.error(
      'Example: ts-node set-authorized-energy-token.ts 0x123... true',
    );
    process.exit(1);
  }

  const addressToAuthorize = args[0];
  const shouldAuthorize = args[1].toLowerCase() === 'true';

  // Validate address format
  if (!ethers.isAddress(addressToAuthorize)) {
    throw new Error(`Invalid address format: ${addressToAuthorize}`);
  }

  // Token contract address
  const tokenAddress = '0x2f4903bEeFbE23c057Bd26587Cd3f0bd6e337136';

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('Token contract address:', tokenAddress);
  console.log('Wallet address:', wallet.address);

  // Get the token contract instance
  const token = new ethers.Contract(
    tokenAddress,
    tokenAbi,
    wallet,
  ) as ethers.Contract & RegularSpaceTokenInterface;

  // Check if the wallet is the owner
  const contractOwner = await token.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the token contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setAuthorized',
    );
  }

  // Check current authorization status
  const currentStatus = await token.authorized(addressToAuthorize);
  console.log(
    `Current authorization status for ${addressToAuthorize}: ${currentStatus}`,
  );

  if (currentStatus === shouldAuthorize) {
    console.log(
      `Address is already ${
        shouldAuthorize ? 'authorized' : 'unauthorized'
      }. No action needed.`,
    );
    return;
  }

  console.log(
    `${
      shouldAuthorize ? 'Authorizing' : 'Deauthorizing'
    } address: ${addressToAuthorize}`,
  );

  try {
    const tx = await token.setAuthorized(addressToAuthorize, shouldAuthorize);

    console.log('Transaction sent, waiting for confirmation...');
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
    console.log(
      `Address ${
        shouldAuthorize ? 'authorized' : 'deauthorized'
      } successfully!`,
    );

    // Verify the change
    const newStatus = await token.authorized(addressToAuthorize);
    console.log(
      `New authorization status for ${addressToAuthorize}: ${newStatus}`,
    );
  } catch (error: any) {
    console.error('Error setting authorization:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
