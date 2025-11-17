import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

const ENERGY_DISTRIBUTION_ADDRESS =
  '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
const OLD_TOKEN_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';

/**
 * Complete automated script to:
 * 1. Deploy new EnergyToken
 * 2. Update EnergyDistribution to use it
 * 3. Authorize EnergyDistribution
 * 4. Run emergency reset
 */

const energyDistributionAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenAddress', type: 'address' },
    ],
    name: 'setEnergyToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEnergyTokenAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
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

const energyTokenAbi = [
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
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
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function loadWallet(
  provider: ethers.JsonRpcProvider,
): Promise<ethers.Wallet> {
  let accountData: AccountData[] = [];

  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      const parsedData = JSON.parse(data);
      accountData = parsedData.filter(
        (account: AccountData) =>
          account.privateKey && account.privateKey.length === 64,
      );
    }
  } catch (error) {
    // Fallback to env
  }

  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      const wallet = new ethers.Wallet(cleanPrivateKey);
      accountData = [{ privateKey: cleanPrivateKey, address: wallet.address }];
    }
  }

  if (accountData.length === 0) {
    throw new Error('No wallet found');
  }

  return new ethers.Wallet(accountData[0].privateKey, provider);
}

async function deployNewToken(): Promise<string> {
  console.log('\n📦 Step 1: Deploying New EnergyToken');
  console.log('='.repeat(60));

  const packageRoot = path.resolve(__dirname, '../..');
  console.log(`Working directory: ${packageRoot}`);

  try {
    const output = execSync(
      'npx hardhat run scripts/energy-token.deploy.ts --network base-mainnet',
      {
        cwd: packageRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      },
    );

    console.log(output);

    // Extract address from output
    const match = output.match(/EnergyToken deployed to: (0x[a-fA-F0-9]{40})/);
    if (!match) {
      throw new Error('Could not extract token address from deployment output');
    }

    const tokenAddress = match[1];
    console.log(`✅ New token deployed: ${tokenAddress}`);
    return tokenAddress;
  } catch (error: any) {
    console.error('Deployment failed:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    throw error;
  }
}

async function updateEnergyDistribution(
  newTokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n🔄 Step 2: Updating EnergyDistribution');
  console.log('='.repeat(60));

  const energyDistribution = new ethers.Contract(
    ENERGY_DISTRIBUTION_ADDRESS,
    energyDistributionAbi,
    wallet,
  );

  // Check whitelist
  const isWhitelisted = await energyDistribution.isAddressWhitelisted(
    wallet.address,
  );
  if (!isWhitelisted) {
    throw new Error('Wallet is not whitelisted on EnergyDistribution');
  }
  console.log('✅ Wallet is whitelisted');

  // Get current token
  const currentToken = await energyDistribution.getEnergyTokenAddress();
  console.log(`Current token: ${currentToken}`);
  console.log(`New token: ${newTokenAddress}`);

  if (currentToken.toLowerCase() === newTokenAddress.toLowerCase()) {
    console.log('✅ Token already set, skipping');
    return;
  }

  // Set new token
  console.log('Sending setEnergyToken transaction...');
  const tx = await energyDistribution.setEnergyToken(newTokenAddress);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('Waiting for confirmation...');
  await tx.wait();
  console.log('✅ Token updated successfully');

  // Verify
  const verifyToken = await energyDistribution.getEnergyTokenAddress();
  if (verifyToken.toLowerCase() !== newTokenAddress.toLowerCase()) {
    throw new Error('Token verification failed');
  }
  console.log('✅ Verification passed');
}

async function authorizeEnergyDistribution(
  tokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n🔐 Step 3: Authorizing EnergyDistribution');
  console.log('='.repeat(60));

  const token = new ethers.Contract(tokenAddress, energyTokenAbi, wallet);

  // Check ownership
  const owner = await token.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`You are not the owner. Owner is: ${owner}`);
  }
  console.log('✅ You are the token owner');

  // Check current authorization
  try {
    const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);
    console.log(
      `Current authorization: ${
        isAuthorized ? 'Authorized' : 'Not Authorized'
      }`,
    );

    if (isAuthorized) {
      console.log('✅ Already authorized, skipping');
      return;
    }
  } catch (error) {
    console.log('Could not check authorization, proceeding to authorize...');
  }

  // Authorize
  console.log('Sending setAuthorized transaction...');
  const tx = await token.setAuthorized(ENERGY_DISTRIBUTION_ADDRESS, true);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('Waiting for confirmation...');
  await tx.wait();
  console.log('✅ Authorization successful');

  // Verify
  const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);
  if (!isAuthorized) {
    throw new Error('Authorization verification failed');
  }
  console.log('✅ Verification passed');
}

async function verifyNewToken(
  tokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n✅ Step 4: Verifying New Token Setup');
  console.log('='.repeat(60));

  const token = new ethers.Contract(tokenAddress, energyTokenAbi, wallet);

  const name = await token.name();
  const decimals = await token.decimals();
  const owner = await token.owner();
  const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);

  console.log(`Token Name: ${name}`);
  console.log(`Decimals: ${decimals} (should be 6)`);
  console.log(`Owner: ${owner}`);
  console.log(
    `EnergyDistribution Authorized: ${isAuthorized ? '✅ Yes' : '❌ No'}`,
  );

  if (decimals !== 6) {
    console.log('⚠️  Warning: Decimals are not 6!');
  }

  if (!isAuthorized) {
    throw new Error('EnergyDistribution is not authorized!');
  }

  console.log('\n✅ All checks passed!');
}

async function main(): Promise<void> {
  console.log('🔧 Complete Energy Token Fix');
  console.log('='.repeat(60));
  console.log(`Old (corrupted) token: ${OLD_TOKEN_ADDRESS}`);
  console.log(`EnergyDistribution: ${ENERGY_DISTRIBUTION_ADDRESS}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = await loadWallet(provider);

  console.log(`🔑 Wallet: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  try {
    // Step 1: Deploy new token
    const newTokenAddress = await deployNewToken();

    // Step 2: Update EnergyDistribution
    await updateEnergyDistribution(newTokenAddress, wallet);

    // Step 3: Authorize EnergyDistribution
    await authorizeEnergyDistribution(newTokenAddress, wallet);

    // Step 4: Verify everything
    await verifyNewToken(newTokenAddress, wallet);

    console.log('\n🎉 SUCCESS! All steps completed!');
    console.log('='.repeat(60));
    console.log(`✅ New EnergyToken: ${newTokenAddress}`);
    console.log(`✅ EnergyDistribution updated`);
    console.log(`✅ Authorization configured`);
    console.log(`\n🚀 Next step: Run emergency reset`);
    console.log(`   ts-node emergency-reset.ts execute`);
  } catch (error) {
    console.error('\n❌ Process failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
