import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const tokenAbi = [
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
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

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const tokenAddress = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const h4Address = '0x83F00d9F2B94DA4872797dd94F6a355F2E346c7D';

  const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

  console.log('🔍 Testing burnFrom authorization\n');

  // Check authorization
  const isAuthorized = await token.authorized(energyDistributionAddress);
  console.log('EnergyDistribution authorized:', isAuthorized);

  // Check H4 balance
  const h4Balance = await token.balanceOf(h4Address);
  console.log('H4 balance:', h4Balance.toString());

  if (h4Balance === 0n) {
    console.log('\n✅ No tokens to burn, test complete');
    return;
  }

  // Try to estimate gas for burnFrom call
  console.log('\n🔥 Testing burnFrom gas estimation...');
  try {
    const tokenWithSigner = new ethers.Contract(tokenAddress, tokenAbi, wallet);
    const gasEstimate = await tokenWithSigner
      .getFunction('burnFrom')
      .estimateGas(h4Address, h4Balance);
    console.log('✅ Gas estimate:', gasEstimate.toString());

    // Now actually call it
    console.log('\n📝 Executing burnFrom...');
    const tx = await tokenWithSigner.getFunction('burnFrom')(
      h4Address,
      h4Balance,
    );
    console.log('Transaction sent:', tx.hash);
    await tx.wait();
    console.log('✅ Burn successful!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
