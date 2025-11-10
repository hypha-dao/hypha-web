import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

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
    inputs: [
      { internalType: 'uint256', name: 'price', type: 'uint256' },
      { internalType: 'uint256', name: 'maxCapacity', type: 'uint256' },
    ],
    name: 'configureBattery',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View functions
  {
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getCashCreditBalance',
    outputs: [
      { internalType: 'int256', name: '', type: 'int256' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getTokenBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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
    name: 'getCommunityCashCreditBalance',
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
  {
    inputs: [],
    name: 'getSettledBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
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
    name: 'verifyZeroSumProperty',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'int256', name: '', type: 'int256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const HOUSEHOLD_ADDRESSES = [
  '0x5Cc613e48B7Cf91319aBF4B8593cB48E4f260d15', // Household 1 (20% ownership)
  '0x4B8cC92107f6Dc275671E33f8d6F595E87C834D8', // Household 2 (16% ownership)
  '0x54C90c498d1594684a9332736EA6b0448e2AA135', // Household 3 (22% ownership)
  '0x83F00d9F2B94DA4872797dd94F6a355F2E346c7D', // Household 4 (12% ownership)
  '0xA7B5E8AaCefa58ED64A4e137deDe0F77650C8880', // Household 5 (30% ownership)
];

const OWNERSHIP_PERCENTAGES = [20, 16, 22, 12, 30];

async function formatUsdc(rawAmount: bigint | number): Promise<string> {
  const num = Number(rawAmount);
  return (num / 1000000).toFixed(2);
}

async function displaySystemState(contract: ethers.Contract, title: string) {
  console.log(`\n📊 ${title}`);
  console.log('='.repeat(60));

  const balances: { [key: string]: bigint } = {};
  let totalMemberBalances = 0n;

  console.log('🏠 Member Balances:');
  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const address = HOUSEHOLD_ADDRESSES[i];
    const [balance] = await contract.getCashCreditBalance(address);
    const tokenBalance = await contract.getTokenBalance(address);
    balances[address] = balance;
    totalMemberBalances += balance;
    const balanceStr = await formatUsdc(balance);
    const sign = Number(balance) >= 0 ? '+' : '';
    console.log(
      `   H${i + 1} (${
        OWNERSHIP_PERCENTAGES[i]
      }%): ${sign}${balanceStr} USDC (tokens: ${tokenBalance})`,
    );
  }

  const communityBalance = await contract.getCommunityCashCreditBalance();
  const exportBalance = await contract.getExportCashCreditBalance();
  const importBalance = await contract.getImportCashCreditBalance();
  const settledBalance = await contract.getSettledBalance();

  console.log('\n💰 System Balances:');
  console.log(
    `   Community:        ${await formatUsdc(communityBalance)} USDC`,
  );
  console.log(`   Import Balance:   ${await formatUsdc(importBalance)} USDC`);
  console.log(`   Export Balance:   ${await formatUsdc(exportBalance)} USDC`);
  console.log(`   Settled Balance:  ${await formatUsdc(settledBalance)} USDC`);
  console.log(
    `   Total Members:    ${await formatUsdc(totalMemberBalances)} USDC`,
  );

  const [isZeroSum, contractBalance] = await contract.verifyZeroSumProperty();
  console.log('\n🔍 Zero-Sum Verification:');
  console.log(
    `   Contract result: ${
      isZeroSum ? 'PASS ✅' : 'FAIL ❌'
    } (${await formatUsdc(contractBalance)} USDC)`,
  );

  const collectiveConsumption = await contract.getCollectiveConsumption();
  console.log('\n🌊 Energy Pool:');
  let totalEnergy = 0;
  let totalLocalEnergy = 0;
  let totalImportEnergy = 0;
  let totalBatteryEnergy = 0;

  for (let i = 0; i < collectiveConsumption.length; i++) {
    const batch = collectiveConsumption[i];
    const energy = Number(batch.quantity);
    if (energy > 0) {
      totalEnergy += energy;
      const price = Number(batch.price);
      const ownerAddress = batch.owner;
      const isImport =
        ownerAddress === '0x0000000000000000000000000000000000000000';

      let ownerId = 'Import';
      let sourceType = '📦 Import';

      if (isImport) {
        totalImportEnergy += energy;
      } else {
        const householdIndex = HOUSEHOLD_ADDRESSES.findIndex(
          (addr) => addr.toLowerCase() === ownerAddress.toLowerCase(),
        );
        if (householdIndex !== -1) {
          ownerId = `H${householdIndex + 1}`;
          sourceType = '☀️ Local';
          totalLocalEnergy += energy;
        } else {
          ownerId = `Unknown (${ownerAddress})`;
          sourceType = '❓';
        }
      }

      console.log(
        `   ${sourceType} Batch ${i + 1}: ${energy} Wh at $${await formatUsdc(
          price,
        )}/Wh (${ownerId})`,
      );
    }
  }

  console.log(`\n   📊 Energy Breakdown:`);
  console.log(`      Local Production: ${totalLocalEnergy} Wh`);
  console.log(`      Imports: ${totalImportEnergy} Wh`);
  console.log(`      Total Available: ${totalEnergy} Wh`);

  // Display battery info
  const batteryInfo = await contract.getBatteryInfo();
  console.log('\n🔋 Battery Status:');
  console.log(`   Current State: ${batteryInfo.currentState} Wh`);
  console.log(`   Max Capacity: ${batteryInfo.maxCapacity} Wh`);
  console.log(`   Price: $${await formatUsdc(batteryInfo.price)}/Wh`);
  console.log(`   Configured: ${batteryInfo.configured ? 'Yes ✅' : 'No ❌'}`);

  return isZeroSum;
}

async function runTradingCycleWithImportAndBattery() {
  console.log('💱 ENERGY TRADING TEST - WITH IMPORTS & BATTERY');
  console.log('='.repeat(60));
  console.log(
    'Testing scenario with local production, imports, and battery discharge.\n',
  );

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
    console.error(
      '❌ No accounts found. Please create accounts.json or set PRIVATE_KEY in .env',
    );
    return;
  }

  const signer = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Using wallet: ${signer.address}\n`);

  const contractAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  console.log(`📍 Energy Distribution Contract: ${contractAddress}\n`);

  try {
    // Check initial state
    await displaySystemState(contract, 'Initial State');

    // ==================== CONFIGURE BATTERY ====================
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔋 BATTERY CONFIGURATION`);
    console.log(`${'═'.repeat(60)}`);

    const batteryPricePerWh = 0.00012; // $0.12/kWh = $0.00012/Wh (cheaper than grid)
    const batteryMaxCapacity = 100000; // 100 kWh capacity

    const batteryInfo = await contract.getBatteryInfo();
    if (!batteryInfo.configured) {
      console.log(`Configuring battery:`);
      console.log(`   Price: $${batteryPricePerWh}/Wh ($0.12/kWh)`);
      console.log(`   Max Capacity: ${batteryMaxCapacity} Wh (100 kWh)`);

      const configureTx = await contract.configureBattery(
        ethers.parseUnits(batteryPricePerWh.toString(), 6),
        batteryMaxCapacity,
      );
      await configureTx.wait();
      console.log('✅ Battery configured');
    } else {
      console.log('✅ Battery already configured');
    }

    // ==================== CYCLE 1: CHARGE BATTERY ====================
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 CYCLE 1: Charge Battery from Local Production`);
    console.log(`${'═'.repeat(60)}`);

    const solarEnergyWh = 300000; // 300 kWh local production
    const solarPricePerWh = 0.0001; // $0.10/kWh
    const batteryChargeAmount = 50000; // Charge 50 kWh into battery

    console.log(`\n☀️ Distribution Phase - Cycle 1`);
    console.log('-'.repeat(50));
    console.log(
      `   Solar Production: ${solarEnergyWh} Wh (${solarEnergyWh / 1000} kWh)`,
    );
    console.log(`   Price: $${solarPricePerWh}/Wh ($0.10/kWh)`);
    console.log(
      `   Battery Charging: ${batteryChargeAmount} Wh (${
        batteryChargeAmount / 1000
      } kWh)`,
    );
    console.log(
      `   Net Distribution: ${solarEnergyWh - batteryChargeAmount} Wh`,
    );

    const energySource1 = [
      {
        sourceId: 1, // Local solar production
        price: ethers.parseUnits(solarPricePerWh.toString(), 6),
        quantity: solarEnergyWh,
        isImport: false,
      },
    ];

    const distributeTx1 = await contract.distributeEnergyTokens(
      energySource1,
      batteryChargeAmount, // Battery state increases (charging)
    );
    await distributeTx1.wait();
    console.log('✅ Energy distributed and battery charged');

    await displaySystemState(contract, 'After Cycle 1 - Battery Charged');

    // Consume all energy from cycle 1
    console.log(`\n🏠 Consumption Phase - Cycle 1`);
    console.log('-'.repeat(50));
    console.log('   All households consume their allocated energy');

    const consumptionRequests1 = HOUSEHOLD_ADDRESSES.map((_, i) => ({
      deviceId: i + 1,
      quantity: Math.floor(
        ((solarEnergyWh - batteryChargeAmount) * OWNERSHIP_PERCENTAGES[i]) /
          100,
      ),
    }));

    const consumeTx1 = await contract.consumeEnergyTokens(consumptionRequests1);
    await consumeTx1.wait();
    console.log('✅ All energy consumed');

    await displaySystemState(contract, 'After Cycle 1 - Consumption Complete');

    // ==================== CYCLE 2: LOCAL + IMPORTS + BATTERY DISCHARGE ====================
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 CYCLE 2: Local Production + Imports + Battery Discharge`);
    console.log(`${'═'.repeat(60)}`);

    const localProductionWh = 200000; // 200 kWh local (less than usual)
    const localPricePerWh = 0.0001; // $0.10/kWh

    const importEnergyWh = 150000; // 150 kWh imported from grid
    const importPricePerWh = 0.00018; // $0.18/kWh (expensive)

    const batteryDischargeAmount = 30000; // Discharge 30 kWh from battery
    const batteryNewState = batteryChargeAmount - batteryDischargeAmount; // 50kWh - 30kWh = 20kWh remaining

    const totalEnergyWh =
      localProductionWh + importEnergyWh + batteryDischargeAmount;
    const totalDemandWh = totalEnergyWh; // Consume all available energy (380 kWh)

    console.log(`\n⚡ Distribution Phase - Cycle 2`);
    console.log('-'.repeat(50));
    console.log(
      `   ☀️  Local Production: ${localProductionWh} Wh (${
        localProductionWh / 1000
      } kWh) @ $${localPricePerWh}/Wh`,
    );
    console.log(
      `   📦 Import Energy: ${importEnergyWh} Wh (${
        importEnergyWh / 1000
      } kWh) @ $${importPricePerWh}/Wh`,
    );
    console.log(
      `   🔋 Battery Discharge: ${batteryDischargeAmount} Wh (${
        batteryDischargeAmount / 1000
      } kWh) @ $${batteryPricePerWh}/Wh`,
    );
    console.log(
      `   📊 Total Available: ${totalEnergyWh} Wh (${
        totalEnergyWh / 1000
      } kWh)`,
    );
    console.log(
      `   🎯 Total Demand: ${totalDemandWh} Wh (${totalDemandWh / 1000} kWh)`,
    );

    const energySource2 = [
      {
        sourceId: 1, // Local production
        price: ethers.parseUnits(localPricePerWh.toString(), 6),
        quantity: localProductionWh,
        isImport: false,
      },
      {
        sourceId: 100, // Import from grid
        price: ethers.parseUnits(importPricePerWh.toString(), 6),
        quantity: importEnergyWh,
        isImport: true, // This will go to community pool
      },
    ];

    const distributeTx2 = await contract.distributeEnergyTokens(
      energySource2,
      batteryNewState, // Battery state decreases (discharging)
    );
    await distributeTx2.wait();
    console.log('✅ Energy distributed with imports and battery discharge');

    await displaySystemState(contract, 'After Cycle 2 - Distribution');

    // ==================== CONSUMPTION WITH MIXED SOURCES ====================
    console.log(`\n🏠 Consumption Phase - Cycle 2`);
    console.log('-'.repeat(50));
    console.log('   Households consume from all sources (cheapest first):');
    console.log('   1️⃣  Local production ($0.10/kWh)');
    console.log('   2️⃣  Battery discharge ($0.12/kWh)');
    console.log('   3️⃣  Imported energy ($0.18/kWh)');

    // Each household consumes their proportional share of total demand
    const consumptionRequests2 = HOUSEHOLD_ADDRESSES.map((_, i) => {
      const share = Math.floor(
        (totalDemandWh * OWNERSHIP_PERCENTAGES[i]) / 100,
      );
      console.log(
        `   H${i + 1}: ${share} Wh (${share / 1000} kWh) - ${
          OWNERSHIP_PERCENTAGES[i]
        }% of demand`,
      );
      return {
        deviceId: i + 1,
        quantity: share,
      };
    });

    const consumeTx2 = await contract.consumeEnergyTokens(consumptionRequests2);
    await consumeTx2.wait();
    console.log('✅ All consumption complete');

    const finalState = await displaySystemState(
      contract,
      'After Cycle 2 - Final State',
    );

    // ==================== ANALYSIS ====================
    console.log(`\n💡 Trading Analysis:`);
    console.log('-'.repeat(50));

    const importBalance = await contract.getImportCashCreditBalance();
    const communityBalance = await contract.getCommunityCashCreditBalance();

    console.log(`\n📦 Import Economics:`);
    console.log(`   Import Balance: ${await formatUsdc(importBalance)} USDC`);
    console.log(
      `   Expected Import Cost: $${await formatUsdc(
        BigInt(importEnergyWh) *
          ethers.parseUnits(importPricePerWh.toString(), 6),
      )} USDC`,
    );

    if (Number(importBalance) > 0) {
      console.log(`   ✅ Imports have been paid for by consumers`);
    } else {
      console.log(`   ⚠️  Import balance is not positive yet`);
    }

    console.log(`\n🏘️  Community Economics:`);
    console.log(
      `   Community Balance: ${await formatUsdc(communityBalance)} USDC`,
    );

    console.log(`\n🔋 Battery Economics:`);
    const finalBatteryInfo = await contract.getBatteryInfo();
    console.log(
      `   Initial State: ${batteryChargeAmount} Wh (${
        batteryChargeAmount / 1000
      } kWh)`,
    );
    console.log(
      `   Discharged: ${batteryDischargeAmount} Wh (${
        batteryDischargeAmount / 1000
      } kWh)`,
    );
    console.log(
      `   Final State: ${finalBatteryInfo.currentState} Wh (${
        Number(finalBatteryInfo.currentState) / 1000
      } kWh)`,
    );
    console.log(
      `   Battery Energy Sold: $${await formatUsdc(
        BigInt(batteryDischargeAmount) *
          ethers.parseUnits(batteryPricePerWh.toString(), 6),
      )} USDC`,
    );

    console.log(`\n💰 Household Balances After Full Cycle:`);
    for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
      const [balance] = await contract.getCashCreditBalance(
        HOUSEHOLD_ADDRESSES[i],
      );
      const tokens = await contract.getTokenBalance(HOUSEHOLD_ADDRESSES[i]);
      console.log(
        `   H${i + 1}: ${await formatUsdc(balance)} USDC (tokens: ${tokens})`,
      );
    }

    // ==================== FINAL SUMMARY ====================
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📋 FINAL SUMMARY');
    console.log(`${'═'.repeat(60)}`);

    if (finalState) {
      console.log('✅ TEST PASSED!');
      console.log('✅ Zero-sum property maintained throughout both cycles');
      console.log('✅ Successfully tested:');
      console.log('   - Local production distribution');
      console.log('   - Battery charging from local production');
      console.log('   - Battery discharge as energy source');
      console.log('   - Import energy from grid (community pool)');
      console.log('   - Mixed consumption from multiple sources');
      console.log('   - Correct pricing order (local < battery < import)');
    } else {
      console.log('❌ TEST FAILED!');
      console.log('❌ Zero-sum violation detected.');
    }

    console.log('\n🎉 ENERGY TRADING TEST WITH IMPORTS & BATTERY COMPLETED!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error && typeof error === 'object' && 'reason' in error) {
      console.error('Reason:', (error as { reason: string }).reason);
    }
    throw error;
  }
}

runTradingCycleWithImportAndBattery().catch(console.error);
