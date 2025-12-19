import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CONTRACT_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';

const rndaoDecayingSpaceTokenAbi = [
  // Read functions
  {
    inputs: [],
    name: 'transferable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [{ internalType: 'bool', name: '_transferable', type: 'bool' }],
    name: 'setTransferable',
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
  console.log('');

  // Get the contract instance
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    rndaoDecayingSpaceTokenAbi,
    wallet,
  );

  // Check current transferable status
  console.log('=== Current transferable status ===');
  const transferableBefore = await contract.transferable();

  console.log('Transferable:', transferableBefore);
  console.log('');

  // Enable transferable if not already enabled
  if (!transferableBefore) {
    console.log('=== Enabling transferable ===');
    try {
      const tx = await contract.setTransferable(true);
      console.log('Transaction sent:', tx.hash);
      console.log('Waiting for confirmation...');
      await tx.wait();
      console.log('✅ Transferable enabled!');
    } catch (error: any) {
      console.error('❌ Error enabling transferable:', error.message);
      throw error;
    }
    console.log('');
  } else {
    console.log('Transferable already enabled, skipping...');
    console.log('');
  }

  // Verify the status after update
  console.log('=== Verifying status after update ===');
  const transferableAfter = await contract.transferable();

  console.log('Transferable:', transferableAfter);
  console.log('');

  if (transferableAfter) {
    console.log('✅ Token transfers are now enabled!');
  } else {
    console.log('❌ Failed to enable transfers. Please check the logs.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

