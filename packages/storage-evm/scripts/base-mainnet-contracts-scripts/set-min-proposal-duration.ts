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

interface DAOProposalsInterface {
  setMinimumProposalDuration: (
    spaceId: ethers.BigNumberish,
    minDuration: ethers.BigNumberish,
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
    DAOProposals: /DAOProposals deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const daoProposalsAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_minDuration',
        type: 'uint256',
      },
    ],
    name: 'setMinimumProposalDuration',
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
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      'Usage: ts-node set-min-proposal-duration.ts <spaceId> <minDurationInSeconds>',
    );
    process.exit(1);
  }

  const spaceId = args[0];
  const minDuration = args[1];

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify all required addresses are available
  if (!addresses['DAOProposals']) {
    throw new Error('Missing address for: DAOProposals');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the DAO Proposals address directly from addresses.txt
  const daoProposalsAddress = addresses['DAOProposals'];

  console.log('DAO Proposals address from addresses.txt:', daoProposalsAddress);

  // Get the DAO Proposals contract instance
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  ) as ethers.Contract & DAOProposalsInterface;

  // Check if the wallet is the owner
  const contractOwner = await daoProposals.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the DAOProposals contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setMinimumProposalDuration',
    );
  }

  console.log(
    `Setting minimum proposal duration for space ${spaceId} to ${minDuration} seconds.`,
  );

  try {
    const tx = await daoProposals.setMinimumProposalDuration(
      spaceId,
      minDuration,
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Minimum proposal duration set successfully in DAOProposals!');
  } catch (error: any) {
    console.error('Error setting minimum proposal duration:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
