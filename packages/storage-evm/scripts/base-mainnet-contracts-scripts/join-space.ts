import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Add these interface definitions to fix the wait() error
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
  // Update return type to use the enhanced interface
  joinSpace: (spaceId: number) => Promise<ContractTransactionWithWait>;
  getSpaceMembers: (spaceId: number) => Promise<string[]>;
}

const daoSpaceFactoryAbi = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_spaceId",
        "type": "uint256"
      }
    ],
    "name": "joinSpace",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_spaceId",
        "type": "uint256"
      }
    ],
    "name": "getSpaceMembers",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main(): Promise<void> {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  
  // Get the contract instance
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS || '',
    daoSpaceFactoryAbi,
    wallet
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  // Get the space ID from .env
  const spaceId = parseInt(process.env.TEST_SPACE_ID || '0');

  try {
    // Get current members before joining
    console.log(`Getting current members of space ${spaceId}...`);
    const membersBefore = await daoSpaceFactory.getSpaceMembers(spaceId);
    console.log('Current members:', membersBefore);

    // Join the space
    console.log(`Joining space ${spaceId}...`);
    const tx = await daoSpaceFactory.joinSpace(spaceId);
    
    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Successfully joined the space!');

    // Get updated members list
    console.log('Getting updated members list...');
    const membersAfter = await daoSpaceFactory.getSpaceMembers(spaceId);
    console.log('Updated members:', membersAfter);

  } catch (error: any) {
    console.error('Error joining space:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 