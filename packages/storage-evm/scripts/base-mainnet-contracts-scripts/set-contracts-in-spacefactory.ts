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

interface DAOSpaceFactoryInterface {
  // Update return type
  setContracts: (
    tokenFactoryAddress: string,
    joinMethodDirectoryAddress: string,
    exitMethodDirectoryAddress: string,
    proposalManagerAddress: string
  ) => Promise<ContractTransactionWithWait>;
}

const daoSpaceFactoryAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_tokenFactoryAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_joinMethodDirectoryAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_exitMethodDirectoryAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_proposalManagerAddress",
        "type": "address"
      }
    ],
    "name": "setContracts",
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
  
  // Get the DAO Space Factory contract instance
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS || '',
    daoSpaceFactoryAbi,
    wallet
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  // Use dummy addresses for other contracts
  const dummyAddress = "0x1111111111111111111111111111111111111111";
  
  // Get the real join method directory address from .env
  const joinMethodDirectoryAddress = process.env.JOIN_METHOD_DIRECTORY_ADDRESS || '';

  console.log('Setting contracts with the following addresses:');
  console.log('Token Factory:', dummyAddress);
  console.log('Join Method Directory:', joinMethodDirectoryAddress);
  console.log('Exit Method Directory:', dummyAddress);
  console.log('Proposal Manager:', dummyAddress);

  try {
    const tx = await daoSpaceFactory.setContracts(
      dummyAddress, // token factory
      joinMethodDirectoryAddress,
      dummyAddress, // exit method directory
      dummyAddress  // proposal manager
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