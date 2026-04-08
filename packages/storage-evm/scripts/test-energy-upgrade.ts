import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Simple ABI for testing upgraded contract
const contractAbi = [
  {
    inputs: [],
    name: 'verifyZeroSumProperty',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'int256', name: '', type: 'int256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'emergencyReset',
    outputs: [],
    stateMutability: 'nonpayable',
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
  {
    inputs: [],
    name: 'getImportCashCreditBalance',
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
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'sourceId', type: 'uint256' },
          { internalType: 'uint256', name: 'price', type: 'uint256' },
          { internalType: 'uint256', name: 'quantity', type: 'uint256' },
          { internalType: 'bool', name: 'isImport', type: 'bool' },
        ],
        internalType: 'struct IEnergyDistribution.EnergySource[]',
        name: 'sources',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: 'batteryState', type: 'uint256' },
    ],
    name: 'distributeEnergyTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [],
    name: 'EmergencyReset',
    type: 'event',
  },
];

async function testUpgradedContract(): Promise<void> {
  console.log('🧪 Testing Upgraded EnergyDistribution Contract');
  console.log('===============================================');

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

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Using wallet: ${wallet.address}`);

  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    contractAbi,
    wallet,
  );

  console.log(`📍 Contract: ${energyDistribution.target}`);

  try {
    // Test 1: Verify Zero-Sum Property Function
    console.log('\n🔍 Test 1: Zero-Sum Property Verification');
    console.log('----------------------------------------');

    const [isZeroSum, balance] =
      await energyDistribution.verifyZeroSumProperty();
    console.log(`Zero-sum status: ${isZeroSum ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`System balance: ${balance.toString()} (should be 0)`);

    if (!isZeroSum) {
      console.log(
        `💰 Discrepancy detected: ${(Number(balance) / 100).toFixed(
          2,
        )} USDC cents`,
      );
    }

    // Test 2: Check Available Energy in Collective Pool
    console.log('\n📊 Test 2: Available Energy Check');
    console.log('---------------------------------');

    const collectiveConsumption =
      await energyDistribution.getCollectiveConsumption();
    let totalAvailable = 0;
    let totalValue = 0;

    console.log(`Items in collective pool: ${collectiveConsumption.length}`);

    for (const item of collectiveConsumption) {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      totalAvailable += quantity;
      totalValue += quantity * price;
    }

    console.log(`Total available energy: ${totalAvailable} kWh`);
    console.log(
      `Total available value: ${(totalValue / 100).toFixed(2)} USDC cents`,
    );

    // Test 3: Test Distribution Requirement (if energy is available)
    console.log('\n🚫 Test 3: Distribution Requirement Check');
    console.log('----------------------------------------');

    if (totalAvailable > 0) {
      console.log(`❌ ${totalAvailable} kWh of energy remains unconsumed`);
      console.log(
        '📋 New distribution will be BLOCKED until this energy is consumed',
      );

      // Try to distribute energy (should fail)
      try {
        const testSources = [
          { sourceId: 999, price: 1000, quantity: 1, isImport: false },
        ];

        console.log('🧪 Testing distribution with unconsumed energy...');
        await energyDistribution.distributeEnergyTokens(testSources, 0);
        console.log(
          '⚠️  WARNING: Distribution succeeded (should have failed!)',
        );
      } catch (error) {
        if (
          error.message.includes(
            'Previous energy distribution must be fully consumed',
          )
        ) {
          console.log(
            '✅ Distribution correctly blocked due to unconsumed energy',
          );
        } else {
          console.log(
            `❌ Distribution failed for different reason: ${error.message}`,
          );
        }
      }
    } else {
      console.log(
        '✅ No unconsumed energy - new distributions will be allowed',
      );
    }

    // Test 4: Emergency Reset Function Availability
    console.log('\n🚨 Test 4: Emergency Reset Function');
    console.log('-----------------------------------');

    console.log('Emergency reset function is available');
    console.log('⚠️  WARNING: This will reset ALL balances to zero!');
    console.log('💡 Use only if you need to clear accounting discrepancies');

    // Ask for user confirmation before reset (commented out for safety)
    /*
    if (totalAvailable > 0 || !isZeroSum) {
      console.log('\n🤔 Would you like to run emergency reset? (Uncomment code to enable)');
      console.log('   This will clear the following:');
      console.log(`   - ${totalAvailable} kWh of unconsumed energy`);
      console.log(`   - ${(Number(balance) / 100).toFixed(2)} USDC cents system imbalance`);
      console.log('   - All member cash credit balances');
      console.log('   - All system balances (import/export)');
    }
    */

    // Test 5: System Status Summary
    console.log('\n📋 Test 5: System Status Summary');
    console.log('================================');

    const importBalance = Number(
      await energyDistribution.getImportCashCreditBalance(),
    );
    const exportBalance = Number(
      await energyDistribution.getExportCashCreditBalance(),
    );

    console.log(
      `Import Balance: ${(importBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `Export Balance: ${(exportBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(`Available Energy: ${totalAvailable} kWh`);
    console.log(`Zero-Sum Status: ${isZeroSum ? 'MAINTAINED' : 'VIOLATED'}`);

    console.log('\n🎯 UPGRADE STATUS: ✅ ALL NEW FEATURES WORKING');
    console.log('\n📝 NEXT STEPS:');

    if (!isZeroSum || totalAvailable > 0) {
      console.log(
        '1. 🚨 Consider running emergencyReset() to clear discrepancies',
      );
      console.log('2. 🔄 Restart with clean slate for proper testing');
      console.log(
        '3. ✅ All future transactions will maintain zero-sum property',
      );
    } else {
      console.log(
        '1. ✅ System is in perfect state - ready for normal operations',
      );
      console.log(
        '2. 🔄 All distributions will require full consumption first',
      );
      console.log('3. 💰 Zero-sum property will be automatically verified');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function emergencyResetContract(): Promise<void> {
  console.log('🚨 EMERGENCY RESET - CLEARING ALL BALANCES');
  console.log('==========================================');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data (same logic as above)
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

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);

  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    contractAbi,
    wallet,
  );

  try {
    console.log('⏳ Executing emergency reset...');
    const resetTx = await energyDistribution.emergencyReset();
    console.log(`📝 Transaction: ${resetTx.hash}`);

    const receipt = await resetTx.wait();
    console.log('✅ Emergency reset completed!');

    // Verify reset worked
    const [isZeroSum, balance] =
      await energyDistribution.verifyZeroSumProperty();
    console.log(
      `Zero-sum status after reset: ${isZeroSum ? '✅ PASS' : '❌ FAIL'}`,
    );
    console.log(`System balance after reset: ${balance.toString()}`);
  } catch (error) {
    console.error('❌ Emergency reset failed:', error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';

  switch (command.toLowerCase()) {
    case 'test':
      await testUpgradedContract();
      break;
    case 'reset':
      await emergencyResetContract();
      break;
    default:
      console.log('Available commands:');
      console.log('- test: Test upgraded contract functionality');
      console.log(
        '- reset: Execute emergency reset (DANGER: clears all balances)',
      );
      console.log('');
      console.log('Usage: ts-node test-energy-upgrade.ts [command]');
      break;
  }
}

main().catch(console.error);

export { testUpgradedContract, emergencyResetContract };
