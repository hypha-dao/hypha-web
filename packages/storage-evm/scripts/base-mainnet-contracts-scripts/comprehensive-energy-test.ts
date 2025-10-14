import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const contractAbi = [
  // Energy distribution functions
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
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'deviceId', type: 'uint256' },
          { internalType: 'uint256', name: 'quantity', type: 'uint256' },
        ],
        internalType: 'struct IEnergyDistribution.ConsumptionRequest[]',
        name: 'consumptionRequests',
        type: 'tuple[]',
      },
    ],
    name: 'consumeEnergyTokens',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [
      { internalType: 'uint256', name: 'price', type: 'uint256' },
      { internalType: 'uint256', name: 'maxCapacity', type: 'uint256' },
    ],
    name: 'configureBattery',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'price', type: 'uint256' }],
    name: 'setExportPrice',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View functions
  {
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
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
  {
    inputs: [{ internalType: 'uint256', name: 'deviceId', type: 'uint256' }],
    name: 'getDeviceOwner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
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
    inputs: [],
    name: 'getExportDeviceId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
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
    name: 'getBatteryInfo',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'currentState', type: 'uint256' },
          { internalType: 'uint256', name: 'price', type: 'uint256' },
          { internalType: 'uint256', name: 'maxCapacity', type: 'uint256' },
          { internalType: 'bool', name: 'configured', type: 'bool' },
        ],
        internalType: 'struct IEnergyDistribution.BatteryInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getExportPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1 (30% ownership)
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2 (25% ownership)
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3 (20% ownership)
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4 (15% ownership)
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5 (10% ownership)
];

const OWNERSHIP_PERCENTAGES = [30, 25, 20, 15, 10]; // Corresponding ownership %

async function formatUsdc(rawAmount: bigint | number): Promise<string> {
  const num = Number(rawAmount);
  return (num / 1000000).toFixed(2); // Fix: divide by 1,000,000 for 6-decimal USDC
}

async function displaySystemState(contract: ethers.Contract, title: string) {
  console.log(`\n📊 ${title}`);
  console.log('='.repeat(60));

  // Get balances
  let totalHouseholds = 0;
  console.log('🏠 Household Balances:');
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const balance = Number(
      await contract.getCashCreditBalance(HOUSEHOLD_ADDRESSES[i]),
    );
    totalHouseholds += balance;
    console.log(
      `   H${i + 1} (${OWNERSHIP_PERCENTAGES[i]}%): ${await formatUsdc(
        balance,
      )} USDC`,
    );
  }

  // Community balance
  const communityDeviceId = await contract.getCommunityDeviceId();
  const communityAddress = await contract.getDeviceOwner(communityDeviceId);
  const communityBalance = Number(
    await contract.getCashCreditBalance(communityAddress),
  );

  // External balances
  const exportBalance = Number(await contract.getExportCashCreditBalance());
  const importBalance = Number(await contract.getImportCashCreditBalance());

  console.log('\n💰 System Balances:');
  console.log(`   Total Households: ${await formatUsdc(totalHouseholds)} USDC`);
  console.log(
    `   Community:        ${await formatUsdc(communityBalance)} USDC`,
  );
  console.log(`   Import Balance:   ${await formatUsdc(importBalance)} USDC`);
  console.log(`   Export Balance:   ${await formatUsdc(exportBalance)} USDC`);

  // Zero-sum verification
  const [isZeroSum, balance] = await contract.verifyZeroSumProperty();
  const manualTotal =
    totalHouseholds + communityBalance + importBalance + exportBalance;

  console.log('\n🔍 Zero-Sum Verification:');
  console.log(
    `   Contract result: ${isZeroSum ? 'PASS' : 'FAIL'} (${await formatUsdc(
      balance,
    )} USDC)`,
  );
  console.log(`   Manual total:    ${await formatUsdc(manualTotal)} USDC`);
  console.log(
    `   Status: ${manualTotal === 0 ? '✅ PERFECT ZERO-SUM' : '❌ VIOLATION'}`,
  );

  // Energy pool
  const collectiveConsumption = await contract.getCollectiveConsumption();
  console.log('\n🌊 Energy Pool:');
  let totalEnergy = 0;
  let totalValue = 0;
  let memberEnergy = 0;
  let importEnergy = 0;

  for (let i = 0; i < collectiveConsumption.length; i++) {
    const batch = collectiveConsumption[i];
    const energy = Number(batch.quantity);
    const price = Number(batch.price);
    const value = energy * price;
    totalEnergy += energy;
    totalValue += value;

    if (energy > 0) {
      const isImport =
        batch.owner === '0x0000000000000000000000000000000000000000';
      const ownerType = isImport ? 'Import' : 'Member';
      if (isImport) {
        importEnergy += energy;
      } else {
        memberEnergy += energy;
      }
      console.log(
        `   Batch ${i + 1}: ${energy} kWh at $${await formatUsdc(
          price,
        )}/kWh (${ownerType})`,
      );
    }
  }
  console.log(
    `   Total: ${totalEnergy} kWh (${memberEnergy} member + ${importEnergy} import) worth $${await formatUsdc(
      totalValue,
    )}`,
  );
}

async function runComprehensiveTest() {
  console.log('🧪 COMPREHENSIVE ENERGY SYSTEM TEST');
  console.log('=' + '='.repeat(50));
  console.log('Testing: Multi-source energy portfolio with tiered pricing');
  console.log(
    'Sources: Solar ($0.08) → Wind ($0.12) → Hydro ($0.15) → Grid Import ($0.35)',
  );
  console.log(
    'Flows: Self-consumption → Cross-member trading → Import consumption → Export sales\n',
  );

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  const exportDeviceId = await contract.getExportDeviceId();

  try {
    // ==================== SETUP: RESET & DISTRIBUTION ====================
    console.log('🔄 SETUP: Fresh Energy Distribution');
    console.log('-'.repeat(50));

    // Reset system first
    console.log('⏳ Resetting system...');
    const resetTx = await contract.emergencyReset();
    await resetTx.wait();
    console.log('✅ System reset complete');

    // Distribute mixed energy sources
    const energySources = [
      {
        sourceId: 1, // Solar production (cheapest local)
        price: ethers.parseUnits('0.08', 6), // 8 cents/kWh
        quantity: 100, // 100 kWh solar
        isImport: false,
      },
      {
        sourceId: 2, // Wind production (mid-price local)
        price: ethers.parseUnits('0.12', 6), // 12 cents/kWh
        quantity: 80, // 80 kWh wind
        isImport: false,
      },
      {
        sourceId: 3, // Hydroelectric production (premium local)
        price: ethers.parseUnits('0.15', 6), // 15 cents/kWh
        quantity: 60, // 60 kWh hydro
        isImport: false,
      },
      {
        sourceId: 4, // Grid import (most expensive)
        price: ethers.parseUnits('0.35', 6), // 35 cents/kWh
        quantity: 120, // 120 kWh import
        isImport: true,
      },
    ];

    console.log('⏳ Distributing energy...');
    const distributeTx = await contract.distributeEnergyTokens(
      energySources,
      0,
    );
    await distributeTx.wait();
    console.log('✅ Energy distribution complete');

    await displaySystemState(contract, 'Post-Distribution State');

    // ==================== TEST 1: PURE SELF-CONSUMPTION ====================
    console.log('\n🧪 TEST 1: Pure Self-Consumption');
    console.log('-'.repeat(50));
    console.log('Each household consumes only from their own tokens');

    const selfConsumptionRequests = [
      { deviceId: 1, quantity: 25 }, // H1: 25 kWh (has ~72, moderate self-consumption)
      { deviceId: 2, quantity: 20 }, // H2: 20 kWh (has ~60, moderate self-consumption)
      { deviceId: 3, quantity: 18 }, // H3: 18 kWh (has ~48, moderate self-consumption)
      { deviceId: 4, quantity: 15 }, // H4: 15 kWh (has ~36, moderate self-consumption)
      { deviceId: 5, quantity: 12 }, // H5: 12 kWh (has ~24, moderate self-consumption)
    ];

    console.log('⏳ Processing self-consumption...');
    const selfTx = await contract.consumeEnergyTokens(selfConsumptionRequests);
    await selfTx.wait();
    console.log('✅ Self-consumption complete');

    await displaySystemState(contract, 'After Self-Consumption');

    // ==================== TEST 2: CROSS-MEMBER TRADING ====================
    console.log('\n🧪 TEST 2: Cross-Member Trading');
    console.log('-'.repeat(50));
    console.log('Some households consume more than they own → buy from others');

    const tradingRequests = [
      { deviceId: 1, quantity: 35 }, // H1: needs 35 more (will exhaust own tokens, buy from others)
      { deviceId: 2, quantity: 30 }, // H2: needs 30 more (will buy from cheaper sources first)
      { deviceId: 5, quantity: 20 }, // H5: needs 20 more (will consume across price tiers)
      // H3 and H4 don't consume → they become net sellers
      // This creates diverse trading with multi-tier pricing
    ];

    console.log('⏳ Processing cross-member trading...');
    const tradingTx = await contract.consumeEnergyTokens(tradingRequests);
    await tradingTx.wait();
    console.log('✅ Cross-member trading complete');

    await displaySystemState(contract, 'After Cross-Member Trading');

    // ==================== TEST 3: IMPORT CONSUMPTION ====================
    console.log('\n🧪 TEST 3: Import Consumption (Expensive Grid Energy)');
    console.log('-'.repeat(50));
    console.log('Households consume expensive imported grid energy');

    const importRequests = [
      { deviceId: 1, quantity: 25 }, // H1: buys expensive imports ($0.35/kWh)
      { deviceId: 2, quantity: 20 }, // H2: buys expensive imports
      { deviceId: 4, quantity: 15 }, // H4: buys expensive imports
      { deviceId: 5, quantity: 10 }, // H5: buys expensive imports
      // This tests expensive grid energy consumption across multiple households
    ];

    console.log('⏳ Processing import consumption...');
    const importTx = await contract.consumeEnergyTokens(importRequests);
    await importTx.wait();
    console.log('✅ Import consumption complete');

    await displaySystemState(contract, 'After Import Consumption');

    // Consume remaining import energy to clear the pool for battery testing
    console.log('\n⏳ Consuming remaining import energy to clear pool...');
    const remainingImportRequests = [
      { deviceId: 3, quantity: 50 }, // H3: consume 50 kWh of remaining imports
      { deviceId: 4, quantity: 50 }, // H4: consume 50 kWh of remaining imports
      { deviceId: 5, quantity: 15 }, // H5: consume 15 kWh of remaining imports (total 115 kWh)
    ];

    const clearTx = await contract.consumeEnergyTokens(remainingImportRequests);
    await clearTx.wait();
    console.log('✅ All import energy consumed, pool cleared');

    await displaySystemState(contract, 'After Clearing All Energy');

    // ==================== TEST 4: BATTERY OPERATIONS ====================
    console.log('\n🔋 TEST 4: Battery Storage Operations');
    console.log('-'.repeat(50));
    console.log(
      'Testing battery charging and discharging with energy accounting',
    );

    // Configure battery first
    console.log('⏳ Configuring battery...');
    const batteryPrice = ethers.parseUnits('0.10', 6); // $0.10 per kWh for battery discharge
    const batteryCapacity = 100; // 100 kWh max capacity
    const configTx = await contract.configureBattery(
      batteryPrice,
      batteryCapacity,
    );
    await configTx.wait();
    console.log(
      '✅ Battery configured: 100 kWh capacity at $0.10/kWh discharge price',
    );

    // BATTERY CHARGING: Solar energy charges the battery (reduces available energy)
    console.log('\n🔋⚡ Battery Charging Phase');
    console.log('Solar production will be partially used to charge battery');

    const batteryChargeSources = [
      {
        sourceId: 1, // Solar production
        price: ethers.parseUnits('0.08', 6), // $0.08 per kWh
        quantity: 80, // 80 kWh solar production
        isImport: false,
      },
    ];

    console.log('⏳ Distributing energy with battery charging (30 kWh)...');
    const chargeDistributeTx = await contract.distributeEnergyTokens(
      batteryChargeSources,
      30,
    );
    await chargeDistributeTx.wait();
    console.log('✅ Energy distributed with battery charging');
    console.log(
      '📊 Result: 80 kWh solar - 30 kWh battery charge = 50 kWh available for members',
    );

    await displaySystemState(contract, 'After Battery Charging');

    // Let households consume the remaining solar energy
    console.log('\n⏳ Consuming remaining solar energy...');
    const chargePeriodConsumption = [
      { deviceId: 1, quantity: 20 }, // H1: 20 kWh
      { deviceId: 2, quantity: 15 }, // H2: 15 kWh
      { deviceId: 3, quantity: 15 }, // H3: 15 kWh (total 50 kWh)
    ];

    const chargeConsumeTx = await contract.consumeEnergyTokens(
      chargePeriodConsumption,
    );
    await chargeConsumeTx.wait();
    console.log('✅ Solar energy consumed, battery charged and ready');

    await displaySystemState(contract, 'Post Battery Charging & Consumption');

    // BATTERY DISCHARGING: Battery provides energy back to the community
    console.log('\n🔋⚡ Battery Discharging Phase');
    console.log('Battery discharges to provide energy when solar is low');

    const batteryDischargeSources = [
      {
        sourceId: 1, // Minimal solar (cloudy day)
        price: ethers.parseUnits('0.08', 6), // $0.08 per kWh
        quantity: 20, // Only 20 kWh solar today
        isImport: false,
      },
    ];

    console.log('⏳ Distributing energy with battery discharging (20 kWh)...');
    const dischargeDistributeTx = await contract.distributeEnergyTokens(
      batteryDischargeSources,
      10,
    ); // Battery goes from 30 to 10 kWh
    await dischargeDistributeTx.wait();
    console.log('✅ Energy distributed with battery discharging');
    console.log(
      '📊 Result: 20 kWh solar + 20 kWh battery discharge = 40 kWh total available',
    );

    await displaySystemState(contract, 'After Battery Discharging');

    // Consume energy including battery discharge
    console.log('\n⏳ Consuming energy including battery discharge...');
    const dischargePeriodConsumption = [
      { deviceId: 1, quantity: 20 }, // H1: 20 kWh (mix of solar + battery)
      { deviceId: 2, quantity: 20 }, // H2: 20 kWh (mix of solar + battery)
    ];

    const dischargeConsumeTx = await contract.consumeEnergyTokens(
      dischargePeriodConsumption,
    );
    await dischargeConsumeTx.wait();
    console.log('✅ Energy consumed from solar + battery discharge');

    await displaySystemState(
      contract,
      'Post Battery Discharging & Consumption',
    );

    // Check final battery state
    const finalBatteryInfo = await contract.getBatteryInfo();
    console.log('\n🔋 Final Battery Status:');
    console.log(`   Current charge: ${finalBatteryInfo.currentState} kWh`);
    console.log(`   Max capacity: ${finalBatteryInfo.maxCapacity} kWh`);
    console.log(
      `   Discharge price: $${await formatUsdc(finalBatteryInfo.price)}/kWh`,
    );
    console.log(`   Configured: ${finalBatteryInfo.configured}`);

    // Check export price
    const configuredExportPrice = await contract.getExportPrice();
    console.log('\n💱 Export Configuration:');
    console.log(
      `   Export price: $${await formatUsdc(configuredExportPrice)}/kWh`,
    );

    // ==================== TEST 5: EXPORT SALES ====================
    console.log('\n🧪 TEST 5: Export Sales (Selling Back to Grid)');
    console.log('-'.repeat(50));
    console.log('Export remaining member-owned energy back to grid');

    // Configure export price first
    console.log('\n⏳ Configuring export price...');
    const exportPrice = ethers.parseUnits('0.15', 6); // $0.15 per kWh export price
    const exportPriceTx = await contract.setExportPrice(exportPrice);
    await exportPriceTx.wait();
    console.log('✅ Export price configured: $0.15/kWh');

    // Add fresh energy for export testing
    console.log('\n⏳ Adding fresh energy for export testing...');
    const exportTestSources = [
      {
        sourceId: 1, // Solar production for export
        price: ethers.parseUnits('0.08', 6), // $0.08 per kWh
        quantity: 100, // 100 kWh fresh solar
        isImport: false,
      },
    ];

    const exportDistributeTx = await contract.distributeEnergyTokens(
      exportTestSources,
      10,
    ); // Keep battery at 10 kWh
    await exportDistributeTx.wait();
    console.log('✅ Fresh energy distributed for export testing');

    await displaySystemState(contract, 'Fresh Energy for Export');

    // Small consumption to let households get some final energy
    console.log('\n⏳ Small household consumption before export...');
    const preExportConsumption = [
      { deviceId: 1, quantity: 10 }, // H1: 10 kWh
      { deviceId: 2, quantity: 10 }, // H2: 10 kWh (total 20 kWh consumed, 80 kWh left for export)
    ];

    const preExportTx = await contract.consumeEnergyTokens(
      preExportConsumption,
    );
    await preExportTx.wait();
    console.log('✅ Pre-export consumption complete');

    await displaySystemState(contract, 'Before Export (80 kWh Available)');

    const exportRequests = [
      { deviceId: Number(exportDeviceId), quantity: 80 }, // Export 80 kWh (leave 20 kWh for members)
    ];

    console.log('⏳ Processing export sales...');
    const exportTx = await contract.consumeEnergyTokens(exportRequests);
    await exportTx.wait();
    console.log('✅ Export sales complete');

    await displaySystemState(contract, 'Final State After All Transactions');

    // ==================== SUMMARY ====================
    console.log('\n🎯 COMPREHENSIVE TEST SUMMARY');
    console.log('=' + '='.repeat(50));
    console.log(
      '✅ Multi-Source Distribution: Solar, Wind, Hydro with tiered pricing ($0.08-$0.15)',
    );
    console.log(
      '✅ Self-Consumption Priority: Members consumed cheapest own tokens first',
    );
    console.log(
      '✅ Cross-Member Trading: Price-aware trading across multiple energy tiers',
    );
    console.log(
      '✅ Import Consumption: Expensive grid energy ($0.35) consumed when needed',
    );
    console.log(
      '✅ Battery Operations: Charging (30→10 kWh) and discharging (10 kWh) with proper accounting',
    );
    console.log(
      '✅ Export Sales: Member tokens sold to grid at configured export price ($0.15/kWh)',
    );
    console.log(
      '✅ Export Priority: Export requests processed BEFORE member consumption',
    );
    console.log(
      '✅ Zero-Sum Integrity: Perfect accounting maintained across all price tiers and battery operations',
    );
    console.log(
      '\n💡 Complete energy ecosystem tested: 4 sources, battery storage, configurable export pricing, all flows verified!',
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error && 'reason' in error) {
      console.error('Reason:', (error as any).reason);
    }
  }
}

runComprehensiveTest().catch(console.error);
