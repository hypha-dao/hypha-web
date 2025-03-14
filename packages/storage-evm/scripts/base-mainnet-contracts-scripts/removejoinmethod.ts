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
  removeJoinMethod: (methodId: number) => Promise<ContractTransactionWithWait>;
}

const joinMethodDirectoryAbi = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_methodId",
        "type": "uint256"
      }
    ],
    "name": "removeJoinMethod",
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
  
  // Get the contract address from .env
  const contractAddress = process.env.JOIN_METHOD_DIRECTORY_ADDRESS || '';
  
  // Get the method ID from .env
  const methodId = parseInt(process.env.JOIN_METHOD || '0');

  // Get the contract instance
  const JoinMethodDirectory = new ethers.Contract(
    contractAddress,
    joinMethodDirectoryAbi,
    wallet
  ) as ethers.Contract & JoinMethodDirectoryInterface;

  console.log(`Removing join method ${methodId}...`);

  // Remove the join method
  const tx = await JoinMethodDirectory.removeJoinMethod(methodId);
  await tx.wait();

  console.log("Join method removed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 