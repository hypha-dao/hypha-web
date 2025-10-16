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
];

const tokenAbi = [
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const tokenAddress = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';

  console.log('🔍 Checking Energy System Setup\n');
  console.log('Wallet:', wallet.address);
  console.log('EnergyDistribution:', energyDistributionAddress);
  console.log('Token:', tokenAddress);
  console.log('');

  // Check 1: Is token set in EnergyDistribution?
  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    provider,
  );

  try {
    const currentToken = await energyDistribution.getEnergyTokenAddress();
    console.log('✓ Energy token address in contract:', currentToken);
    if (
      currentToken.toLowerCase() === ethers.ZeroAddress.toLowerCase() ||
      currentToken.toLowerCase() ===
        '0x0000000000000000000000000000000000000000'
    ) {
      console.log('❌ ERROR: Energy token is not set (zero address)!');
      console.log('   Run: ts-node set-energy-token.ts', tokenAddress);
      return;
    }
    if (currentToken.toLowerCase() !== tokenAddress.toLowerCase()) {
      console.log(
        `⚠️  WARNING: Energy token mismatch! Expected ${tokenAddress}`,
      );
    }
  } catch (error) {
    console.log('❌ ERROR: Could not read energy token address');
    console.error(error);
    return;
  }

  // Check 2: Is EnergyDistribution authorized on token?
  const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

  try {
    const isAuthorized = await token.authorized(energyDistributionAddress);
    console.log(
      `${
        isAuthorized ? '✓' : '❌'
      } EnergyDistribution authorized on token: ${isAuthorized}`,
    );
    if (!isAuthorized) {
      console.log(
        '   Run: ts-node set-authorized-energy-token.ts',
        energyDistributionAddress,
        'true',
      );
    }
  } catch (error) {
    console.log('❌ ERROR: Could not check authorization status');
    console.error(error);
    return;
  }

  // Check 3: Token owner
  try {
    const tokenOwner = await token.owner();
    console.log('✓ Token owner:', tokenOwner);
    if (tokenOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log(
        `   ⚠️  Note: Your wallet (${wallet.address}) is not the token owner`,
      );
    }
  } catch (error) {
    console.log('⚠️  Could not check token owner');
  }

  console.log('\n✅ Setup check complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
