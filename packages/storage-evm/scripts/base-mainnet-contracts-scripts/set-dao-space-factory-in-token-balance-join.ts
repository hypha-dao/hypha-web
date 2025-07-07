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

interface TokenBalanceJoinInterface {
  setDAOSpaceFactory: (
    daoSpaceFactoryAddress: string,
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
    DAOSpaceFactory: /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
    TokenBalanceJoin: /TokenBalanceJoin deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const tokenBalanceJoinAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_daoSpaceFactory',
        type: 'address',
      },
    ],
    name: 'setDAOSpaceFactory',
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

  // Verify all required addresses are available
  const requiredContracts = ['DAOSpaceFactory', 'TokenBalanceJoin'];
  const missingContracts = requiredContracts.filter(
    (contract) => !addresses[contract],
  );

  if (missingContracts.length > 0) {
    throw new Error(`Missing addresses for: ${missingContracts.join(', ')}`);
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the TokenBalanceJoin address directly from addresses.txt
  const tokenBalanceJoinAddress = addresses['TokenBalanceJoin'];
  const daoSpaceFactoryAddress = addresses['DAOSpaceFactory'];

  console.log(
    'TokenBalanceJoin address from addresses.txt:',
    tokenBalanceJoinAddress,
  );
  console.log(
    'DAOSpaceFactory address from addresses.txt:',
    daoSpaceFactoryAddress,
  );

  // Get the TokenBalanceJoin contract instance
  const tokenBalanceJoin = new ethers.Contract(
    tokenBalanceJoinAddress,
    tokenBalanceJoinAbi,
    wallet,
  ) as ethers.Contract & TokenBalanceJoinInterface;

  // Check if the wallet is the owner
  const contractOwner = await tokenBalanceJoin.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the TokenBalanceJoin contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setDAOSpaceFactory',
    );
  }

  console.log('Setting DAOSpaceFactory in TokenBalanceJoin:');
  console.log('DAOSpaceFactory:', daoSpaceFactoryAddress);

  try {
    const tx = await tokenBalanceJoin.setDAOSpaceFactory(
      daoSpaceFactoryAddress,
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('DAOSpaceFactory set successfully in TokenBalanceJoin!');
  } catch (error: any) {
    console.error('Error setting DAOSpaceFactory:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
