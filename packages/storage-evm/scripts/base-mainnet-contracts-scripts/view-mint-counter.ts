import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// ABI for accessing the public mintCounter variable
const mintCounterAbi = [
  {
    // Public variables automatically generate getter functions in Solidity
    inputs: [],
    name: 'mintCounter',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function viewMintCounter(): Promise<void> {
  console.log('Fetching mintCounter value...');

  // Connect to the provider - no wallet needed for read operations
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Initialize the KWHERC20Implementation contract
  const kwherc20Address = process.env.KWHERC20_ADDRESS;
  if (!kwherc20Address) {
    console.error('KWHERC20_ADDRESS not found in environment variables.');
    return;
  }

  console.log(`Using KWHERC20 contract at: ${kwherc20Address}`);

  // Connect to the contract using just the provider
  const kwherc20Contract = new ethers.Contract(
    kwherc20Address,
    mintCounterAbi,
    provider,
  );

  try {
    // Read the mintCounter value directly
    const mintCounter = await kwherc20Contract.mintCounter();

    console.log('\nMint Counter Details:');
    console.log('--------------------');
    console.log(`Total mint operations: ${mintCounter.toString()}`);

    // Additional helpful information
    if (mintCounter.toString() === '0') {
      console.log('\nNo minting operations have been performed yet.');
    } else {
      console.log(
        `\nThis means ${mintCounter.toString()} minting operations have been recorded.`,
      );
      console.log(
        'You can view individual mint records using the view-mint-record.ts script.',
      );
      console.log(
        'Valid record IDs range from 1 to ' + mintCounter.toString() + '.',
      );
    }
  } catch (error) {
    console.error('Error retrieving mint counter:', error);
    console.log(
      'Make sure the KWHERC20_ADDRESS is correct and the contract is deployed on the network.',
    );
  }
}

// Execute the script
viewMintCounter().catch(console.error);
