import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const energyDistributionAbi = [
  {
    inputs: [],
    name: 'emergencyReset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'getCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isAddressWhitelisted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const HOUSEHOLD_ADDRESSES = [
  '0x5Cc613e48B7Cf91319aBF4B8593cB48E4f260d15',
  '0x4B8cC92107f6Dc275671E33f8d6F595E87C834D8',
  '0x54C90c498d1594684a9332736EA6b0448e2AA135',
  '0x83F00d9F2B94DA4872797dd94F6a355F2E346c7D',
  '0xA7B5E8AaCefa58ED64A4e137deDe0F77650C8880',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  console.log('🧪 Simulating Emergency Reset\n');
  console.log('Wallet:', wallet.address);
  console.log('Contract:', energyDistributionAddress);

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  );

  // Check if whitelisted
  const isWhitelisted = await energyDistribution.isAddressWhitelisted(
    wallet.address,
  );
  console.log('Is whitelisted:', isWhitelisted);

  if (!isWhitelisted) {
    console.error('❌ Wallet is not whitelisted!');
    return;
  }

  // Check balances before
  console.log('\n📊 Balances before reset:');
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const [balance] = await energyDistribution.getCashCreditBalance(
      HOUSEHOLD_ADDRESSES[i],
    );
    console.log(`  H${i + 1}: ${balance.toString()}`);
  }

  // Try calling emergencyReset with gas estimate
  console.log('\n🔄 Attempting emergency reset...');

  try {
    console.log('Estimating gas...');
    const gasEstimate = await energyDistribution.emergencyReset.estimateGas();
    console.log('Gas estimate:', gasEstimate.toString());
  } catch (error: any) {
    console.error('❌ Gas estimation failed:', error.message);
    console.error('Error code:', error.code);

    // Try to get more details
    if (error.data) {
      console.error('Error data:', error.data);
    }

    // Try calling it directly to get the revert reason
    console.log('\nTrying static call to get revert reason...');
    try {
      await energyDistribution.emergencyReset.staticCall();
    } catch (staticError: any) {
      console.error('Static call error:', staticError.message);
      if (staticError.data) {
        console.error('Static error data:', staticError.data);
      }
    }

    return;
  }

  try {
    const tx = await energyDistribution.emergencyReset();
    console.log('Transaction sent:', tx.hash);
    await tx.wait();
    console.log('✅ Reset successful!');
  } catch (error: any) {
    console.error('❌ Transaction failed:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
