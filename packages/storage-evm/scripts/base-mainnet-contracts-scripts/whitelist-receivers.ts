import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CONTRACT_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';

const ADDRESSES_TO_CHECK = [
  '0x18Dd436E941825C367cCf55aee6555508b15D76E',
  '0x5e0320a690Fe2569250697573BB88714cCd74ec5',
  '0x0b939b844787c498Ad39683f35589a7D188b54f4',
  '0xFE2De084E594ef8f3096d15bf7d0F3DfcB59D082',
  '0x8d249FDf6E2d716F9219D889f826e5EFa786D83d',
  '0x9ed9f6a5a1c09150E5Bf5bD33ed7F5855222402c',
  '0x335C371524dEeCF4dfCA1AcF405F2100955c64f2',
];

const rndaoDecayingSpaceTokenAbi = [
  // Read functions
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
  console.log('');

  // Get the contract instance
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    rndaoDecayingSpaceTokenAbi,
    wallet,
  );

  // Check which addresses need to be whitelisted
  console.log('=== Checking receive whitelist status ===');
  const addressesToWhitelist: string[] = [];

  for (const address of ADDRESSES_TO_CHECK) {
    const canReceive = await contract.canReceive(address);
    if (canReceive) {
      console.log(`✅ ${address} - already whitelisted`);
    } else {
      console.log(`❌ ${address} - NOT whitelisted, will add`);
      addressesToWhitelist.push(address);
    }
  }
  console.log('');

  // If all addresses are already whitelisted, exit
  if (addressesToWhitelist.length === 0) {
    console.log('✅ All addresses are already whitelisted to receive tokens!');
    return;
  }

  console.log(`Found ${addressesToWhitelist.length} addresses to whitelist`);
  console.log('');

  // Whitelist the addresses that need it
  console.log('=== Adding addresses to receive whitelist ===');
  const allowedArray = addressesToWhitelist.map(() => true);

  try {
    const tx = await contract.batchSetReceiveWhitelist(
      addressesToWhitelist,
      allowedArray,
    );
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    await tx.wait();
    console.log('✅ Addresses added to receive whitelist!');
  } catch (error: any) {
    console.error('❌ Error setting receive whitelist:', error.message);
    throw error;
  }
  console.log('');

  // Verify the whitelist was set correctly
  console.log('=== Verifying whitelist status after update ===');
  let allVerified = true;

  for (const address of addressesToWhitelist) {
    const canReceive = await contract.canReceive(address);
    if (canReceive) {
      console.log(`✅ ${address} - verified`);
    } else {
      console.log(`❌ ${address} - verification FAILED`);
      allVerified = false;
    }
  }
  console.log('');

  if (allVerified) {
    console.log('✅ All addresses successfully whitelisted to receive tokens!');
  } else {
    console.log(
      '❌ Some addresses failed verification. Please check the logs.',
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
