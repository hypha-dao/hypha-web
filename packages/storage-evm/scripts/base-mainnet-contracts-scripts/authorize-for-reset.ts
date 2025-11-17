import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

/**
 * Quick script to authorize EnergyDistribution contract to burn tokens
 * This must be done before running emergency reset
 */

const TOKEN_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
const ENERGY_DISTRIBUTION_ADDRESS =
  '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

const tokenAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'bool', name: '_authorized', type: 'bool' },
    ],
    name: 'setAuthorized',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main(): Promise<void> {
  console.log('🔐 Energy Token Authorization Tool');
  console.log('='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(`\n📍 Token Address: ${TOKEN_ADDRESS}`);
  console.log(`📍 EnergyDistribution: ${ENERGY_DISTRIBUTION_ADDRESS}`);
  console.log(`🔑 Your Address: ${wallet.address}\n`);

  const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);

  try {
    // Check ownership
    const owner = await token.owner();
    console.log(`Token Owner: ${owner}`);

    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(`\n❌ ERROR: You are not the token owner!`);
      console.error(`   Ask ${owner} to run this script`);
      process.exit(1);
    }
    console.log('✅ You are the token owner\n');

    // Check current status
    console.log('Checking current authorization...');
    const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);
    console.log(
      `Current Status: ${isAuthorized ? '✅ Authorized' : '❌ Not Authorized'}`,
    );

    if (isAuthorized) {
      console.log('\n✅ EnergyDistribution is already authorized!');
      console.log('You can proceed with emergency reset.');
      return;
    }

    // Authorize
    console.log('\n🔧 Authorizing EnergyDistribution contract...');
    const tx = await token.setAuthorized(ENERGY_DISTRIBUTION_ADDRESS, true);
    console.log(`📝 Transaction sent: ${tx.hash}`);

    console.log('⏳ Waiting for confirmation...');
    await tx.wait();
    console.log('✅ Transaction confirmed!');

    // Verify
    const newStatus = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);
    console.log(
      `\nNew Status: ${newStatus ? '✅ Authorized' : '❌ Not Authorized'}`,
    );

    if (newStatus) {
      console.log('\n🎉 SUCCESS!');
      console.log('EnergyDistribution is now authorized to burn tokens.');
      console.log('You can now run: ts-node emergency-reset.ts execute');
    } else {
      console.error('\n❌ Authorization failed to verify');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
