import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const tokenAbi = [
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
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
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

  const tokenAddress = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

  console.log('🔍 Debug Reset - Manual Simulation\n');

  // Step 1: Check all balances
  console.log('📊 Current Token Balances:');
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const balance = await token.balanceOf(HOUSEHOLD_ADDRESSES[i]);
    console.log(`  H${i + 1}: ${balance.toString()}`);
  }

  // Step 2: Try manual burn/transfers to simulate what _setCashCreditBalance does
  console.log(
    '\n🧪 Simulating _setCashCreditBalance(member, 0) for each member:\n',
  );

  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const member = HOUSEHOLD_ADDRESSES[i];
    const currentTokenBalance = await token.balanceOf(member);

    console.log(`H${i + 1} (${member}):`);
    console.log(`  Current balance: ${currentTokenBalance.toString()}`);

    if (currentTokenBalance > 0n) {
      console.log(`  Trying to burn ${currentTokenBalance}...`);
      try {
        // Simulate what EnergyDistribution would do
        const tx = await token.burnFrom(member, currentTokenBalance);
        console.log(`  ✅ Burn successful, tx: ${tx.hash}`);
        await tx.wait();
      } catch (error: any) {
        console.error(`  ❌ Burn failed: ${error.message}`);
        if (error.data) {
          console.error(`  Error data: ${error.data}`);
        }
        break;
      }
    } else {
      console.log('  No tokens to burn');
    }
  }

  console.log('\n✅ Manual simulation complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
