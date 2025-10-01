import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

async function setEnergyTokenAddress(tokenAddress: string): Promise<void> {
  if (!ethers.isAddress(tokenAddress)) {
    console.error(`❌ Invalid token address: ${tokenAddress}`);
    return;
  }

  console.log(`🔧 Setting Energy Token Address...`);
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      const parsedData = JSON.parse(data);
      // Filter out placeholder entries
      accountData = parsedData.filter(
        (account: AccountData) =>
          account.privateKey &&
          account.privateKey !== 'YOUR_PRIVATE_KEY_HERE_WITHOUT_0x_PREFIX' &&
          account.privateKey.length === 64,
      );
    }
  } catch (error) {
    console.log('accounts.json not found. Using environment variables.');
  }

  // Fallback to environment variable
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
    console.error(
      '❌ No accounts found. Please create accounts.json or set PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Using wallet: ${wallet.address}`);

  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

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
  ];

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  );

  console.log(`📍 Energy Distribution Contract: ${energyDistribution.target}`);
  console.log('');

  try {
    console.log(`Setting token address to: ${tokenAddress}`);
    const tx = await energyDistribution.setEnergyToken(tokenAddress);
    console.log(`⏳ Set token address tx: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Energy Token address set successfully.`);

    const newTokenAddress = await energyDistribution.getEnergyTokenAddress();
    console.log(`🔎 New token address: ${newTokenAddress}`);
    if (newTokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
      console.log('✅ Verification successful!');
    } else {
      console.error('❌ Verification failed!');
    }
  } catch (error) {
    console.error(`❌ Failed to set token address:`, error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const tokenAddress = args[0];

  if (!tokenAddress) {
    console.log(
      'Usage: ts-node scripts/base-mainnet-contracts-scripts/set-energy-token.ts <tokenAddress>',
    );
    return;
  }

  await setEnergyTokenAddress(tokenAddress);
}

main().catch(console.error);
