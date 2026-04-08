import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const TOKEN_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
const ENERGY_DISTRIBUTION_ADDRESS =
  '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

async function main(): Promise<void> {
  console.log('🔍 Debugging Token Authorization');
  console.log('='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(`\n📍 Token Address: ${TOKEN_ADDRESS}`);
  console.log(`📍 EnergyDistribution: ${ENERGY_DISTRIBUTION_ADDRESS}`);
  console.log(`🔑 Your Address: ${wallet.address}\n`);

  // Step 1: Check if it's a proxy and get implementation
  console.log('Step 1: Checking proxy implementation...');
  try {
    // EIP-1967 implementation slot
    const implSlot =
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const implData = await provider.getStorage(TOKEN_ADDRESS, implSlot);
    const implementationAddress = '0x' + implData.slice(-40);
    console.log(`Implementation Address: ${implementationAddress}`);
  } catch (error) {
    console.log('Could not determine implementation address');
  }

  // Step 2: Try various ABIs
  console.log('\nStep 2: Testing different function signatures...');

  // Try the basic ABI
  const basicAbi = [
    {
      inputs: [],
      name: 'owner',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
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
  ];

  const token = new ethers.Contract(TOKEN_ADDRESS, basicAbi, wallet);

  try {
    const owner = await token.owner();
    console.log(`✅ Owner call works: ${owner}`);
  } catch (error) {
    console.log(`❌ Owner call failed: ${error}`);
  }

  // Step 3: Try to authorize directly without checking
  console.log('\nStep 3: Attempting direct authorization...');
  console.log(
    '⚠️  This will attempt to authorize without checking current status',
  );

  try {
    console.log('Sending setAuthorized transaction...');
    const tx = await token.setAuthorized(ENERGY_DISTRIBUTION_ADDRESS, true);
    console.log(`📝 Transaction sent: ${tx.hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

    console.log('\n🎉 Authorization transaction completed!');
    console.log('The contract should now be authorized.');
    console.log('\nNext step: Run emergency-reset.ts execute');
  } catch (error: any) {
    console.log(`❌ Authorization failed: ${error.message}`);

    if (error.message.includes('Ownable')) {
      console.log('\n💡 You are not the owner of this contract');
    } else if (error.message.includes('already')) {
      console.log('\n💡 The address might already be authorized');
    } else {
      console.log('\n💡 Unknown error - see details above');
    }
  }

  // Step 4: Try to read the storage slot directly
  console.log('\nStep 4: Checking storage layout...');
  try {
    // authorized mapping is typically at slot 0 or later
    // For UUPS proxies, we need to account for implementation storage
    // Let's try reading a few storage slots
    for (let i = 0; i < 10; i++) {
      const slot = ethers.zeroPadValue(ethers.toBeHex(i), 32);
      const value = await provider.getStorage(TOKEN_ADDRESS, slot);
      if (value !== '0x' + '0'.repeat(64)) {
        console.log(`Slot ${i}: ${value}`);
      }
    }
  } catch (error) {
    console.log('Could not read storage slots');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
