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

interface DAOSpaceFactoryInterface {
  // Update return type
  setContracts: (
    tokenFactoryAddress: string,
    joinMethodDirectoryAddress: string,
    exitMethodDirectoryAddress: string,
    proposalManagerAddress: string,
  ) => Promise<ContractTransactionWithWait>;
}

// Function to parse addresses from addresses.txt
function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(__dirname, '../../contracts/addresses.txt');
  const fileContent = fs.readFileSync(addressesPath, 'utf8');
  
  const addresses: Record<string, string> = {};
  
  // Extract contract addresses using regex
  const patterns = {
    'DAOSpaceFactory': /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
    'JoinMethodDirectory': /JoinMethodDirectory deployed to: (0x[a-fA-F0-9]{40})/,
    'ExitMethodDirectory': /ExitMethodDirectory deployed to: (0x[a-fA-F0-9]{40})/,
    'DAOProposals': /DAOProposals deployed to: (0x[a-fA-F0-9]{40})/,
    'TokenFactory': /TokenFactory deployed to: (0x[a-fA-F0-9]{40})/,
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }
  
  return addresses;
}

const daoSpaceFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenFactoryAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_joinMethodDirectoryAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_exitMethodDirectoryAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_proposalManagerAddress',
        type: 'address',
      },
    ],
    name: 'setContracts',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();
  
  // Verify all required addresses are available
  const requiredContracts = ['TokenFactory', 'JoinMethodDirectory', 'ExitMethodDirectory', 'DAOProposals'];
  const missingContracts = requiredContracts.filter(contract => !addresses[contract]);
  
  if (missingContracts.length > 0) {
    throw new Error(`Missing addresses for: ${missingContracts.join(', ')}`);
  }
  
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the DAO Space Factory address from environment or addresses file
  const daoSpaceFactoryAddress = process.env.DAO_SPACE_FACTORY_ADDRESS || addresses['DAOSpaceFactory'];
  
  if (!daoSpaceFactoryAddress) {
    throw new Error('DAOSpaceFactory address is required but not found');
  }

  // Get the DAO Space Factory contract instance
  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  console.log('Setting contracts with the following addresses:');
  console.log('Token Factory:', addresses['TokenFactory']);
  console.log('Join Method Directory:', addresses['JoinMethodDirectory']);
  console.log('Exit Method Directory:', addresses['ExitMethodDirectory']);
  console.log('Proposal Manager:', addresses['DAOProposals']);

  try {
    const tx = await daoSpaceFactory.setContracts(
      addresses['TokenFactory'],
      addresses['JoinMethodDirectory'],
      addresses['ExitMethodDirectory'],
      addresses['DAOProposals']
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Contracts set successfully!');
  } catch (error: any) {
    console.error('Error setting contracts:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
