import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CONTRACT_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';

const ADDRESSES_TO_WHITELIST = [
  '0xeE20d9344762B17f4925066922948Ba29606f013',
  '0x6930098be6C1d3142FfBCc5921fe29Ea77d2e828',
  '0xBbB55389831D3b01338Ed91b637FC21a606F3357',
];

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
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'canTransfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'canReceive',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [
      { internalType: 'address[]', name: 'accounts', type: 'address[]' },
      { internalType: 'bool[]', name: 'allowed', type: 'bool[]' },
    ],
    name: 'batchSetTransferWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'accounts', type: 'address[]' },
      { internalType: 'bool[]', name: 'allowed', type: 'bool[]' },
    ],
    name: 'batchSetReceiveWhitelist',
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
  console.log('Addresses to whitelist:', ADDRESSES_TO_WHITELIST);
  console.log('');

  // Get the contract instance
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    rndaoDecayingSpaceTokenAbi,
    wallet,
  );

  // Check if whitelists are enabled
  console.log('=== Checking whitelist status ===');
  const isTransferWhitelistEnabled = await contract.useTransferWhitelist();
  const isReceiveWhitelistEnabled = await contract.useReceiveWhitelist();

  console.log('Transfer whitelist enabled:', isTransferWhitelistEnabled);
  console.log('Receive whitelist enabled:', isReceiveWhitelistEnabled);
  console.log('');

  if (!isTransferWhitelistEnabled && !isReceiveWhitelistEnabled) {
    console.log(
      '⚠️  WARNING: Both whitelists are disabled. The whitelist settings will be stored but not enforced.',
    );
    console.log('');
  }

  // Check current whitelist status for each address
  console.log('=== Current whitelist status ===');
  for (const address of ADDRESSES_TO_WHITELIST) {
    const canTransferStatus = await contract.canTransfer(address);
    const canReceiveStatus = await contract.canReceive(address);
    console.log(`${address}:`);
    console.log(`  Can transfer: ${canTransferStatus}`);
    console.log(`  Can receive: ${canReceiveStatus}`);
  }
  console.log('');

  // Prepare the allowed array (all true)
  const allowedArray = ADDRESSES_TO_WHITELIST.map(() => true);

  // Set transfer whitelist
  console.log('=== Setting transfer whitelist ===');
  try {
    const txTransfer = await contract.batchSetTransferWhitelist(
      ADDRESSES_TO_WHITELIST,
      allowedArray,
    );
    console.log('Transaction sent:', txTransfer.hash);
    console.log('Waiting for confirmation...');
    await txTransfer.wait();
    console.log('✅ Transfer whitelist set successfully!');
  } catch (error: any) {
    console.error('❌ Error setting transfer whitelist:', error.message);
    throw error;
  }
  console.log('');

  // Set receive whitelist
  console.log('=== Setting receive whitelist ===');
  try {
    const txReceive = await contract.batchSetReceiveWhitelist(
      ADDRESSES_TO_WHITELIST,
      allowedArray,
    );
    console.log('Transaction sent:', txReceive.hash);
    console.log('Waiting for confirmation...');
    await txReceive.wait();
    console.log('✅ Receive whitelist set successfully!');
  } catch (error: any) {
    console.error('❌ Error setting receive whitelist:', error.message);
    throw error;
  }
  console.log('');

  // Verify the whitelist was set correctly
  console.log('=== Verifying whitelist status after update ===');
  let allVerified = true;
  for (const address of ADDRESSES_TO_WHITELIST) {
    const canTransferStatus = await contract.canTransfer(address);
    const canReceiveStatus = await contract.canReceive(address);
    console.log(`${address}:`);
    console.log(`  Can transfer: ${canTransferStatus}`);
    console.log(`  Can receive: ${canReceiveStatus}`);

    if (!canTransferStatus || !canReceiveStatus) {
      allVerified = false;
      console.log(`  ❌ Verification failed for this address!`);
    } else {
      console.log(`  ✅ Verified`);
    }
  }
  console.log('');

  if (allVerified) {
    console.log(
      '✅ All addresses successfully whitelisted for both transfer and receive!',
    );
  } else {
    console.log(
      '❌ Some addresses failed verification. Please check the logs above.',
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
