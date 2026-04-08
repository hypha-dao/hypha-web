import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const energyDistributionAbi = [
  {
    inputs: [],
    name: 'getEnergyTokenAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCollectiveConsumption',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'uint256', name: 'price', type: 'uint256' },
          { internalType: 'uint256', name: 'quantity', type: 'uint256' },
        ],
        internalType: 'struct IEnergyDistribution.CollectiveConsumption[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const tokenAbi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'burnFrom',
    outputs: [],
    stateMutability: 'nonpayable',
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

  console.log('🔍 Testing Reset Step-by-Step\n');
  console.log('Wallet:', wallet.address);

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  );

  // Get token address
  const tokenAddress = await energyDistribution.getEnergyTokenAddress();
  console.log('Token address:', tokenAddress);

  const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

  // Check collective consumption
  console.log('\n📊 Collective Consumption State:');
  const collectiveConsumption =
    await energyDistribution.getCollectiveConsumption();
  console.log('Number of batches:', collectiveConsumption.length);

  // Check member token balances
  console.log('\n💰 Member Token Balances:');
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const balance = await token.balanceOf(HOUSEHOLD_ADDRESSES[i]);
    console.log(`  H${i + 1}: ${balance.toString()} tokens`);
  }

  // Try to burn from first member with tokens
  console.log('\n🔥 Testing burnFrom:');
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const balance = await token.balanceOf(HOUSEHOLD_ADDRESSES[i]);
    if (balance > 0n) {
      console.log(`\nTrying to burn ${balance} tokens from H${i + 1}...`);
      try {
        const tx = await token.burnFrom(HOUSEHOLD_ADDRESSES[i], balance);
        console.log('Transaction sent:', tx.hash);
        await tx.wait();
        console.log('✅ Burn successful!');
        break;
      } catch (error: any) {
        console.error('❌ Burn failed:', error.message);
        if (error.data) {
          console.error('Error data:', error.data);
        }
        break;
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
