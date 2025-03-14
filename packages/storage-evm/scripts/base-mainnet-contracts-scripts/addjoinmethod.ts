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
  addJoinMethod: (methodId: number, implementation: string) => Promise<ContractTransactionWithWait>;
}

const joinMethodDirectoryAbi = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_methodId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_implementation",
        "type": "address"
      }
    ],
    "name": "addJoinMethod",
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
  
  // Get the method ID and implementation address from .env
  const methodId = parseInt(process.env.JOIN_METHOD || '0');
  const implementationAddress = process.env.DIRECTORY_ADDRESS || '';

  // Get the contract instance
  const JoinMethodDirectory = new ethers.Contract(
    contractAddress,
    joinMethodDirectoryAbi,
    wallet
  ) as ethers.Contract & JoinMethodDirectoryInterface;

  console.log(`Adding join method ${methodId} with implementation ${implementationAddress}...`);

  // Add the join method
  const tx = await JoinMethodDirectory.addJoinMethod(methodId, implementationAddress);
  await tx.wait();

  console.log("Join method added successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 