import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface SpaceCreationParams {
  unity: number;
  quorum: number;
  votingPowerSource: number;
  exitMethod: number;
  joinMethod: number;
}

// Enhanced type definitions to fix errors
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
  createSpace: (params: SpaceCreationParams) => Promise<ContractTransactionWithWait>;
  getSpaceMembers: (spaceId: number) => Promise<string[]>;
  getSpaceExecutor: (spaceId: number) => Promise<string>;
}

interface AccountData {
  privateKey: string;
  address: string;
}

const daoSpaceFactoryAbi = [
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "unity",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quorum",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "votingPowerSource",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "exitMethod",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "joinMethod",
            "type": "uint256"
          }
        ],
        "internalType": "struct DAOSpaceFactoryImplementation.SpaceCreationParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "createSpace",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
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
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_spaceId",
        "type": "uint256"
      }
    ],
    "name": "getSpaceExecutor",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function testCreateSpace(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS || '',
    daoSpaceFactoryAbi,
    provider
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  let accountData: AccountData[] = [];
  
  try {
    // Try to read accounts from file
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log('accounts.json not found or invalid. Using default account.');
    // Use the account from .env
    if (process.env.PRIVATE_KEY) {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
      accountData = [{
        privateKey: process.env.PRIVATE_KEY,
        address: wallet.address
      }];
    }
  }

  if (accountData.length === 0) {
    console.error('No accounts found. Please create an accounts.json file or provide a PRIVATE_KEY in .env');
    return;
  }

  console.log('Testing createSpace function...');

  for (let i = 0; i < accountData.length; i++) {
    const wallet = new ethers.Wallet(accountData[i].privateKey, provider);
    const connectedFactory = daoSpaceFactory.connect(wallet) as ethers.Contract & DAOSpaceFactoryInterface;

    // Test data for space creation matching SpaceCreationParams
    const spaceParams: SpaceCreationParams = {
      unity: 51, // uint256 unity requirement
      quorum: 51, // uint256 quorum requirement
      votingPowerSource: 1, // uint256 voting power source
      exitMethod: 2, // uint256 exit method
      joinMethod: 1, // uint256 join method
    };

    try {
      // Create space with the simplified parameters
      console.log(`Creating space with unity: ${spaceParams.unity}, quorum: ${spaceParams.quorum}`);
      const tx = await connectedFactory.createSpace(spaceParams);

      const receipt = await tx.wait();
      
      // Find the SpaceCreated event in the receipt
      const event = receipt?.logs.find(
        log => log.topics[0] === ethers.id(
          "SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)"
        )
      );

      if (event) {
        const spaceId = parseInt(event.topics[1]);
        console.log(`Space created with ID: ${spaceId}`);

        // Verify space creation
        const members = await daoSpaceFactory.getSpaceMembers(spaceId);
        console.log(`Initial members: ${members}`);
        console.log(`Creator address: ${wallet.address}`);
        
        // Verify executor
        const executor = await daoSpaceFactory.getSpaceExecutor(spaceId);
        console.log(`Space executor address: ${executor}`);

        // Verify creator is first member
        if (members[0] === wallet.address) {
          console.log('Verification successful: Creator is the first member');
        } else {
          console.error('Verification failed: Creator is not the first member');
        }
      }

    } catch (error) {
      console.error(`Error creating space for account ${wallet.address}:`, error);
    }
  }

  console.log('Create space testing completed.');
}

// Usage
testCreateSpace().catch(console.error); 