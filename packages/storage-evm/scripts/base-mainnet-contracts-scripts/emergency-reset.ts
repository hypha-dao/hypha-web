import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Energy Distribution contract ABI - functions needed for emergency reset
const energyDistributionAbi = [
  {
    inputs: [],
    name: 'emergencyReset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
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
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
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
  // Events
  {
    anonymous: false,
    inputs: [],
    name: 'EmergencyReset',
    type: 'event',
  },
];

async function checkSystemStatus(energyDistribution: any): Promise<{
  isZeroSum: boolean;
  systemBalance: bigint;
  importBalance: bigint;
  exportBalance: bigint;
  availableEnergy: number;
  totalValue: number;
  communityBalance: bigint;
}> {
  console.log('🔍 Checking Current System Status...');
  console.log('-'.repeat(40));

  // Check zero-sum property
  const [isZeroSum, systemBalance] =
    await energyDistribution.verifyZeroSumProperty();

  // Check balances
  const importBalance = await energyDistribution.getImportCashCreditBalance();
  const exportBalance = await energyDistribution.getExportCashCreditBalance();

  // Check collective consumption
  const collectiveConsumption =
    await energyDistribution.getCollectiveConsumption();
  let availableEnergy = 0;
  let totalValue = 0;

  for (const item of collectiveConsumption) {
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    availableEnergy += quantity;
    totalValue += quantity * price;
  }

  // Check community balance
  let communityBalance = BigInt(0);
  try {
    const communityDeviceId = await energyDistribution.getCommunityDeviceId();
    const communityAddress = await energyDistribution.getDeviceOwner(
      communityDeviceId,
    );
    if (communityAddress !== '0x0000000000000000000000000000000000000000') {
      [communityBalance] = await energyDistribution.getCashCreditBalance(
        communityAddress,
      );
    }
  } catch (error) {
    console.log('⚠️  Could not check community balance');
  }

  // Display results
  console.log(
    `Zero-sum status: ${isZeroSum ? '✅ MAINTAINED' : '❌ VIOLATED'}`,
  );
  console.log(`System balance: ${systemBalance.toString()} (should be 0)`);
  console.log(
    `Import balance: ${(Number(importBalance) / 100).toFixed(2)} USDC cents`,
  );
  console.log(
    `Export balance: ${(Number(exportBalance) / 100).toFixed(2)} USDC cents`,
  );
  console.log(
    `Community balance: ${(Number(communityBalance) / 100).toFixed(
      2,
    )} USDC cents`,
  );
  console.log(`Available energy: ${availableEnergy} kWh`);
  console.log(`Available value: ${(totalValue / 100).toFixed(2)} USDC cents`);

  return {
    isZeroSum,
    systemBalance,
    importBalance,
    exportBalance,
    availableEnergy,
    totalValue,
    communityBalance,
  };
}

async function executeEmergencyReset(): Promise<void> {
  console.log('🚨 EMERGENCY RESET - DANGER ZONE');
  console.log('⚠️  THIS WILL CLEAR ALL BALANCES AND ENERGY TOKENS!');
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load wallet (same logic as setup-community-address.ts)
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
    console.error(
      '❌ No accounts found. Please create accounts.json or set PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Using wallet: ${wallet.address}`);

  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  );

  console.log(
    `📍 Energy Distribution Contract: ${energyDistributionAddress}\n`,
  );

  try {
    // Step 1: Check current system status
    console.log('📋 Step 1: Pre-Reset System Analysis');
    console.log('=====================================');

    const preResetStatus = await checkSystemStatus(energyDistribution);

    // Step 2: Show what will be reset
    console.log('\n🗑️ Step 2: Items That Will Be Cleared');
    console.log('=====================================');
    console.log('✅ All collective consumption energy tokens');
    console.log('✅ All member allocated tokens');
    console.log('✅ All member cash credit balances');
    console.log('✅ Community cash credit balance');
    console.log('✅ Import cash credit balance');
    console.log('✅ Export cash credit balance');
    console.log('✅ Battery state reset to 0');
    console.log('\n❌ Items that will NOT be affected:');
    console.log('- Member registrations (addresses, device IDs, ownership)');
    console.log('- Battery configuration (price, max capacity)');
    console.log('- Device ID assignments (export, community)');

    // Step 3: Warning and confirmation
    console.log('\n⚠️  Step 3: Final Warning');
    console.log('========================');
    console.log('🚨 YOU ARE ABOUT TO PERMANENTLY DELETE:');
    if (preResetStatus.availableEnergy > 0) {
      console.log(
        `   💰 ${preResetStatus.availableEnergy} kWh of energy tokens (${(
          preResetStatus.totalValue / 100
        ).toFixed(2)} USDC cents value)`,
      );
    }
    if (preResetStatus.systemBalance !== BigInt(0)) {
      console.log(
        `   💸 System balance discrepancy of ${(
          Number(preResetStatus.systemBalance) / 100
        ).toFixed(2)} USDC cents`,
      );
    }
    if (preResetStatus.importBalance !== BigInt(0)) {
      console.log(
        `   📥 Import balance of ${(
          Number(preResetStatus.importBalance) / 100
        ).toFixed(2)} USDC cents`,
      );
    }
    if (preResetStatus.exportBalance !== BigInt(0)) {
      console.log(
        `   📤 Export balance of ${(
          Number(preResetStatus.exportBalance) / 100
        ).toFixed(2)} USDC cents`,
      );
    }
    if (preResetStatus.communityBalance !== BigInt(0)) {
      console.log(
        `   🏘️ Community balance of ${(
          Number(preResetStatus.communityBalance) / 100
        ).toFixed(2)} USDC cents`,
      );
    }

    console.log('\n💡 This action is IRREVERSIBLE!');
    console.log('💡 Only proceed if you want to start with a clean slate');
    console.log('💡 Consider running this on a test network first');

    // Step 4: Execute the reset
    console.log('\n⏳ Step 4: Executing Emergency Reset...');
    console.log('======================================');

    console.log('🔥 Sending emergency reset transaction...');
    const resetTx = await energyDistribution.emergencyReset();
    console.log(`📝 Transaction submitted: ${resetTx.hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await resetTx.wait();
    console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}`);

    // Step 5: Verify the reset worked
    console.log('\n🔍 Step 5: Post-Reset Verification');
    console.log('==================================');

    const postResetStatus = await checkSystemStatus(energyDistribution);

    // Check if reset was successful
    const resetSuccess =
      postResetStatus.isZeroSum &&
      postResetStatus.systemBalance === BigInt(0) &&
      postResetStatus.importBalance === BigInt(0) &&
      postResetStatus.exportBalance === BigInt(0) &&
      postResetStatus.availableEnergy === 0 &&
      postResetStatus.communityBalance === BigInt(0);

    if (resetSuccess) {
      console.log('\n🎉 EMERGENCY RESET SUCCESSFUL!');
      console.log('==============================');
      console.log('✅ All balances cleared to zero');
      console.log('✅ All energy tokens removed');
      console.log('✅ Zero-sum property restored');
      console.log('✅ System ready for fresh start');

      console.log('\n🚀 Next Steps:');
      console.log('- Members are still registered and can participate');
      console.log('- Battery configuration is preserved');
      console.log('- You can now run energy distribution without conflicts');
      console.log(
        '- All future transactions will maintain zero-sum accounting',
      );
    } else {
      console.log('\n⚠️  RESET VERIFICATION FAILED');
      console.log('=============================');
      console.log('Some balances may not have been properly cleared:');
      if (!postResetStatus.isZeroSum) {
        console.log(
          `❌ Zero-sum still violated: ${postResetStatus.systemBalance.toString()}`,
        );
      }
      if (postResetStatus.availableEnergy > 0) {
        console.log(
          `❌ Energy tokens still exist: ${postResetStatus.availableEnergy} kWh`,
        );
      }
      console.log('🔧 You may need to investigate the contract state manually');
    }
  } catch (error) {
    console.error('\n❌ Emergency reset failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Ownable: caller is not the owner')) {
      console.log('💡 Only the contract owner can execute emergency reset');
      console.log('💡 Make sure you are using the correct admin wallet');
    } else if (errorMessage.includes('Zero-sum violation')) {
      console.log(
        '💡 The reset itself may have succeeded, but the zero-sum check failed',
      );
      console.log(
        '💡 This could indicate a deeper issue with the contract logic',
      );
    } else {
      console.log('💡 Check your network connection and gas settings');
      console.log('💡 Verify the contract address is correct');
    }
  }
}

async function checkResetNeed(): Promise<void> {
  console.log('🔍 Emergency Reset Assessment');
  console.log('='.repeat(40));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    provider,
  );

  console.log(`📍 Contract: ${energyDistributionAddress}\n`);

  try {
    const status = await checkSystemStatus(energyDistribution);

    console.log('\n📊 Reset Recommendation:');
    console.log('========================');

    let needsReset = false;
    const issues = [];

    if (!status.isZeroSum) {
      needsReset = true;
      issues.push(
        `❌ Zero-sum violated by ${(Number(status.systemBalance) / 100).toFixed(
          2,
        )} USDC cents`,
      );
    }

    if (status.availableEnergy > 0) {
      needsReset = true;
      issues.push(
        `❌ ${status.availableEnergy} kWh of unconsumed energy blocking new distributions`,
      );
    }

    if (
      status.importBalance !== BigInt(0) ||
      status.exportBalance !== BigInt(0)
    ) {
      if (status.importBalance !== BigInt(0)) {
        issues.push(
          `ℹ️  Import balance: ${(Number(status.importBalance) / 100).toFixed(
            2,
          )} USDC cents`,
        );
      }
      if (status.exportBalance !== BigInt(0)) {
        issues.push(
          `ℹ️  Export balance: ${(Number(status.exportBalance) / 100).toFixed(
            2,
          )} USDC cents`,
        );
      }
    }

    if (needsReset) {
      console.log('🚨 EMERGENCY RESET RECOMMENDED');
      console.log('Issues found:');
      for (const issue of issues) {
        console.log(`   ${issue}`);
      }
      console.log('\n💡 Run: npm run emergency-reset execute');
      console.log('⚠️  This will clear ALL balances and energy tokens!');
    } else {
      console.log('✅ SYSTEM IS HEALTHY');
      console.log('No emergency reset needed');
      if (issues.length > 0) {
        console.log('\nNon-critical observations:');
        for (const issue of issues) {
          console.log(`   ${issue}`);
        }
      }
      console.log('\n🚀 System ready for normal operations');
    }
  } catch (error) {
    console.error('❌ Status check failed:', error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';

  console.log('🚨 Emergency Reset Management Tool');
  console.log(`🎯 Command: ${command}\n`);

  switch (command.toLowerCase()) {
    case 'execute':
    case 'reset':
      await executeEmergencyReset();
      break;
    case 'check':
    case 'status':
      await checkResetNeed();
      break;
    default:
      console.log('Available commands:');
      console.log('- check: Assess if emergency reset is needed');
      console.log(
        '- execute: Execute emergency reset (DANGER: clears all balances)',
      );
      console.log('');
      console.log('Usage: npm run emergency-reset [command]');
      console.log('');
      console.log('⚠️  WARNING: Emergency reset is irreversible!');
      console.log(
        '💡 Always run "check" first to understand what will be cleared',
      );
      break;
  }
}

main().catch(console.error);

export { executeEmergencyReset, checkResetNeed };
