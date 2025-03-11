require('dotenv').config();
const { ethers } = require('ethers');

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

async function main() {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  // Get the contract instance
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS,
    daoSpaceFactoryAbi,
    wallet
  );

  // Get the space ID from .env
  const spaceId = process.env.TEST_SPACE_ID;

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

  } catch (error) {
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