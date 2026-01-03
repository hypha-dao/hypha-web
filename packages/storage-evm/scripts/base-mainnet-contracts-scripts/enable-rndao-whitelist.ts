import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CONTRACT_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';

const rndaoDecayingSpaceTokenAbi = [
  // Read functions
  {
    inputs: [],
    name: 'useTransferWhitelist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'useReceiveWhitelist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [{ internalType: 'bool', name: 'enabled', type: 'bool' }],
    name: 'setUseTransferWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bool', name: 'enabled', type: 'bool' }],
    name: 'setUseReceiveWhitelist',
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

  // Check current whitelist status
  console.log('=== Current whitelist status ===');
  const transferWhitelistBefore = await contract.useTransferWhitelist();
  const receiveWhitelistBefore = await contract.useReceiveWhitelist();

  console.log('Transfer whitelist enabled:', transferWhitelistBefore);
  console.log('Receive whitelist enabled:', receiveWhitelistBefore);
  console.log('');

  // Enable transfer whitelist if not already enabled
  if (!transferWhitelistBefore) {
    console.log('=== Enabling transfer whitelist ===');
    try {
      const txTransfer = await contract.setUseTransferWhitelist(true);
      console.log('Transaction sent:', txTransfer.hash);
      console.log('Waiting for confirmation...');
      await txTransfer.wait();
      console.log('✅ Transfer whitelist enabled!');
    } catch (error: any) {
      console.error('❌ Error enabling transfer whitelist:', error.message);
      throw error;
    }
    console.log('');
  } else {
    console.log('Transfer whitelist already enabled, skipping...');
    console.log('');
  }

  // Enable receive whitelist if not already enabled
  if (!receiveWhitelistBefore) {
    console.log('=== Enabling receive whitelist ===');
    try {
      const txReceive = await contract.setUseReceiveWhitelist(true);
      console.log('Transaction sent:', txReceive.hash);
      console.log('Waiting for confirmation...');
      await txReceive.wait();
      console.log('✅ Receive whitelist enabled!');
    } catch (error: any) {
      console.error('❌ Error enabling receive whitelist:', error.message);
      throw error;
    }
    console.log('');
  } else {
    console.log('Receive whitelist already enabled, skipping...');
    console.log('');
  }

  // Verify the whitelist status after update
  console.log('=== Verifying whitelist status after update ===');
  const transferWhitelistAfter = await contract.useTransferWhitelist();
  const receiveWhitelistAfter = await contract.useReceiveWhitelist();

  console.log('Transfer whitelist enabled:', transferWhitelistAfter);
  console.log('Receive whitelist enabled:', receiveWhitelistAfter);
  console.log('');

  if (transferWhitelistAfter && receiveWhitelistAfter) {
    console.log('✅ Both whitelists are now enabled!');
  } else {
    console.log('❌ Some whitelists failed to enable. Please check the logs.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

