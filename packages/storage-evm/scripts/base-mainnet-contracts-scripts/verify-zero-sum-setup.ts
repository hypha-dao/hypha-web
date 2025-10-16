import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Simple ABI for checking setup
const contractAbi = [
  {
    inputs: [],
    name: 'getCommunityDeviceId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'deviceId', type: 'uint256' }],
    name: 'getDeviceOwner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getExportCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getImportCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function verifyZeroSumSetup(): Promise<void> {
  console.log('🔍 Verifying Zero-Sum Accounting Setup');
  console.log('=====================================');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      const parsedData = JSON.parse(data);
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
    console.error('❌ No accounts found. Please set PRIVATE_KEY in .env');
    return;
  }

  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    contractAbi,
    provider,
  );

  console.log(`📍 Contract: ${energyDistribution.target}`);

  try {
    // Step 1: Check community device ID setup
    console.log('\n🏘️ Step 1: Community Device Setup');
    console.log('----------------------------------');

    const communityDeviceId = await energyDistribution.getCommunityDeviceId();
    console.log(`Community Device ID: ${communityDeviceId}`);

    const communityAddress = await energyDistribution.getDeviceOwner(
      communityDeviceId,
    );
    console.log(`Community Address: ${communityAddress}`);

    if (communityAddress === '0x0000000000000000000000000000000000000000') {
      console.log(
        '❌ CRITICAL ISSUE: No member assigned to community device ID!',
      );
      console.log(
        '💡 This will break zero-sum accounting for self-consumption.',
      );
      console.log(
        '🔧 Run: npm run configure-energy (with the updated script) to fix this.',
      );
      return;
    } else {
      console.log('✅ Community member properly assigned!');
    }

    // Step 2: Verify zero-sum property
    console.log('\n💰 Step 2: Zero-Sum Verification');
    console.log('--------------------------------');

    // Get all household addresses from events (simplified approach)
    const householdAddresses = [
      '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a',
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    ];

    let totalHouseholdBalance = 0;
    let communityBalance = 0;
    let validBalances = 0;

    console.log('Household Balances:');
    for (let i = 0; i < householdAddresses.length; i++) {
      try {
        const balance = Number(
          (await energyDistribution.getCashCreditBalance(householdAddresses[i]))[0],
        );
        totalHouseholdBalance += balance;
        validBalances++;
        console.log(
          `  Household ${i + 1}: ${balance / 100} USDC cents (${balance} raw)`,
        );
      } catch (error) {
        console.log(`  Household ${i + 1}: Unable to read balance`);
      }
    }

    // Community balance
    try {
      communityBalance = Number(
        (await energyDistribution.getCashCreditBalance(communityAddress))[0],
      );
      console.log(
        `Community Fund: ${
          communityBalance / 100
        } USDC cents (${communityBalance} raw)`,
      );
    } catch (error) {
      console.log(`Community Fund: Unable to read balance`);
    }

    // System balances
    const exportBalance = Number(
      await energyDistribution.getExportCashCreditBalance(),
    );
    const importBalance = Number(
      await energyDistribution.getImportCashCreditBalance(),
    );

    console.log(`\nSystem Balances:`);
    console.log(
      `  Export Balance: ${
        exportBalance / 100
      } USDC cents (${exportBalance} raw)`,
    );
    console.log(
      `  Import Balance: ${
        importBalance / 100
      } USDC cents (${importBalance} raw)`,
    );

    const totalSystemBalance =
      totalHouseholdBalance + communityBalance + exportBalance + importBalance;

    console.log(`\n🔍 Zero-Sum Check:`);
    console.log(`  All Households: ${totalHouseholdBalance / 100} USDC cents`);
    console.log(`  Community Fund: ${communityBalance / 100} USDC cents`);
    console.log(`  Export Balance: ${exportBalance / 100} USDC cents`);
    console.log(`  Import Balance: ${importBalance / 100} USDC cents`);
    console.log(`  ─────────────────────────────────────────────`);
    console.log(
      `  TOTAL SYSTEM:   ${
        totalSystemBalance / 100
      } USDC cents (${totalSystemBalance} raw)`,
    );

    if (totalSystemBalance === 0) {
      console.log(`\n✅ PERFECT! Zero-sum property maintained!`);
      console.log(
        `✅ All balances sum to exactly ZERO - accounting is correct!`,
      );
    } else {
      console.log(`\n❌ WARNING! Zero-sum property violated!`);
      console.log(`❌ Total should be 0 but is ${totalSystemBalance}`);
      console.log(
        `🔍 This indicates an accounting error in the energy trading system`,
      );
    }

    console.log(`\n📊 Setup Status:`);
    console.log(
      `✅ Community device properly configured: Device ID ${communityDeviceId}`,
    );
    console.log(`✅ Community member exists: ${communityAddress}`);
    console.log(
      `✅ Zero-sum accounting ${
        totalSystemBalance === 0 ? 'WORKING' : 'BROKEN'
      }`,
    );
    console.log(`📈 Balance reads: ${validBalances}/5 households successful`);
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function main(): Promise<void> {
  await verifyZeroSumSetup();
}

main().catch(console.error);

export { verifyZeroSumSetup };
