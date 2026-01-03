import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CONTRACT_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';
const SPACE_ID = 530;

const rndaoDecayingSpaceTokenAbi = [
  {
    inputs: [
      { internalType: 'uint256[]', name: 'spaceIds', type: 'uint256[]' },
    ],
    name: 'batchAddReceiveWhitelistSpaces',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('Connected with wallet:', wallet.address);
  console.log('Contract address:', CONTRACT_ADDRESS);
  console.log('Space ID to whitelist:', SPACE_ID);
  console.log('');

  // Get the contract instance
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    rndaoDecayingSpaceTokenAbi,
    wallet,
  );

  // Add space to receive whitelist
  // The contract will skip if already whitelisted (no duplicate event emitted)
  console.log(`=== Adding space ${SPACE_ID} to receive whitelist ===`);
  try {
    const tx = await contract.batchAddReceiveWhitelistSpaces([SPACE_ID]);
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log(`✅ Space ${SPACE_ID} added to receive whitelist!`);
  } catch (error: any) {
    console.error('❌ Error adding space to whitelist:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
