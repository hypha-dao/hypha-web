require('dotenv').config();
const { ethers } = require('ethers');

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

async function main() {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  // Get the contract address from .env
  const contractAddress = process.env.JOIN_METHOD_DIRECTORY_ADDRESS;
  
  // Get the method ID from .env
  const methodId = process.env.JOIN_METHOD;

  // Get the contract instance
  const JoinMethodDirectory = new ethers.Contract(
    contractAddress,
    joinMethodDirectoryAbi,
    wallet
  );

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