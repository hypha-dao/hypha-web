import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const tokenAbi = [
  {
    inputs: [],
    name: 'maxSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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
  const tokenAddress = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

  console.log('🪙 Token Supply Information\n');

  const maxSupply = await token.maxSupply();
  const totalSupply = await token.totalSupply();

  console.log('Max Supply:', maxSupply.toString());
  console.log('Total Supply:', totalSupply.toString());
  console.log('Remaining capacity:', (maxSupply - totalSupply).toString());
  console.log('');

  if (maxSupply === 0n) {
    console.log('✅ No max supply limit (unlimited minting)');
  } else {
    console.log('⚠️  Max supply is limited!');
    const remaining = maxSupply - totalSupply;
    console.log(`   Can mint ${remaining} more tokens`);
  }

  console.log('\n💰 Current Token Balances:');
  let totalInCirculation = 0n;
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const balance = await token.balanceOf(HOUSEHOLD_ADDRESSES[i]);
    totalInCirculation += balance;
    console.log(`  H${i + 1}: ${balance.toString()} tokens`);
  }

  const energyDistBalance = await token.balanceOf(energyDistributionAddress);
  totalInCirculation += energyDistBalance;
  console.log(`  EnergyDistribution: ${energyDistBalance.toString()} tokens`);

  console.log(`\n  Total in circulation: ${totalInCirculation.toString()}`);
  console.log(`  Reported totalSupply: ${totalSupply.toString()}`);

  if (totalInCirculation !== totalSupply) {
    console.log('  ⚠️  Mismatch detected!');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
