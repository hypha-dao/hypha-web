import dotenv from 'dotenv';
import { ethers } from 'ethers';

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

interface JoinMethodDirectoryInterface {
  // Update return type
  setSpaceFactory: (spaceFactory: string) => Promise<ContractTransactionWithWait>;
}

const joinMethodDirectoryAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_spaceFactory",
        "type": "address"
      }
    ],
    "name": "setSpaceFactory",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

async function main(): Promise<void> {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  
  // Get the contract addresses from .env
  const joinMethodDirectoryAddress = process.env.JOIN_METHOD_DIRECTORY_ADDRESS || '';
  const spaceFactoryAddress = process.env.DAO_SPACE_FACTORY_ADDRESS || '';

  console.log('Join Method Directory Address:', joinMethodDirectoryAddress);
  console.log('Space Factory Address to set:', spaceFactoryAddress);

  // Get the contract instance
  const joinMethodDirectory = new ethers.Contract(
    joinMethodDirectoryAddress,
    joinMethodDirectoryAbi,
    wallet
  ) as ethers.Contract & JoinMethodDirectoryInterface;

  try {
    console.log('Setting space factory address...');
    const tx = await joinMethodDirectory.setSpaceFactory(spaceFactoryAddress);
    
    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Space factory address set successfully!');
  } catch (error: any) {
    console.error('Error setting space factory:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 