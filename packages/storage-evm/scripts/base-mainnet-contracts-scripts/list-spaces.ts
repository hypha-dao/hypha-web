import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface SpaceDetails {
  unity: bigint;
  quorum: bigint;
  votingPowerSource: bigint;
  tokenAddresses: string[];
  members: string[];
  exitMethod: bigint;
  joinMethod: bigint;
  createdAt: bigint;
  creator: string;
  executor: string;
}

interface DAOSpaceFactoryInterface {
  getSpaceDetails: (spaceId: number) => Promise<SpaceDetails>;
  spaceCounter: () => Promise<bigint>;
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
    "name": "getSpaceDetails",
    "outputs": [
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
        "internalType": "address[]",
        "name": "tokenAddresses",
        "type": "address[]"
      },
      {
        "internalType": "address[]",
        "name": "members",
        "type": "address[]"
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
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "executor",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "spaceCounter",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main(): Promise<void> {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // Get the contract instance
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS || '',
    daoSpaceFactoryAbi,
    provider
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  try {
    // Get total number of spaces
    const spaceCounter = await daoSpaceFactory.spaceCounter();
    console.log(`Total number of spaces: ${spaceCounter}\n`);

    // Iterate through all spaces
    for (let spaceId = 1; spaceId <= Number(spaceCounter); spaceId++) {
      try {
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        
        // Format timestamp to human readable date
        const createdDate = new Date(Number(spaceDetails.createdAt) * 1000).toLocaleString();

        console.log(`\n=== Space ${spaceId} ===`);
        console.log('Unity:', Number(spaceDetails.unity), '%');
        console.log('Quorum:', Number(spaceDetails.quorum), '%');
        console.log('Voting Power Source:', Number(spaceDetails.votingPowerSource));
        console.log('Token Addresses:', spaceDetails.tokenAddresses);
        console.log('Members:', spaceDetails.members);
        console.log('Exit Method:', Number(spaceDetails.exitMethod));
        console.log('Join Method:', Number(spaceDetails.joinMethod));
        console.log('Created At:', createdDate);
        console.log('Creator:', spaceDetails.creator);
        console.log('Executor:', spaceDetails.executor);
        console.log('Number of Members:', spaceDetails.members.length);
        console.log('===============\n');

      } catch (error: any) {
        console.error(`Error fetching details for space ${spaceId}:`, error.message);
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 