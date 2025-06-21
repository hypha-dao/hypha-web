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

interface RegularTokenFactoryInterface {
  setSpacesContract: (
    spacesContract: string,
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

  // Extract contract addresses using regex - updated to match your addresses.txt format
  const patterns = {
    DAOSpaceFactory: /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
    RegularTokenFactory:
      /RegularTokenFactory proxy deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const regularTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_spacesContract',
        type: 'address',
      },
    ],
    name: 'setSpacesContract',
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
  const requiredContracts = ['DAOSpaceFactory', 'RegularTokenFactory'];
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

  // Use the RegularTokenFactory address directly from addresses.txt
  const regularTokenFactoryAddress = addresses['RegularTokenFactory'];

  console.log(
    'RegularTokenFactory address from addresses.txt:',
    regularTokenFactoryAddress,
  );

  // Get the RegularTokenFactory contract instance
  const regularTokenFactory = new ethers.Contract(
    regularTokenFactoryAddress,
    regularTokenFactoryAbi,
    wallet,
  ) as ethers.Contract & RegularTokenFactoryInterface;

  // Check if the wallet is the owner
  const contractOwner = await regularTokenFactory.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the RegularTokenFactory contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setSpacesContract',
    );
  }

  console.log(
    'Setting spaces contract in RegularTokenFactory with the following address:',
  );
  console.log('DAOSpaceFactory:', addresses['DAOSpaceFactory']);

  try {
    const tx = await regularTokenFactory.setSpacesContract(
      addresses['DAOSpaceFactory'],
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Spaces contract set successfully in RegularTokenFactory!');
  } catch (error: any) {
    console.error('Error setting spaces contract:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
