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
    balances[address] = balance;
    totalMemberBalances += balance;
    console.log(
      `   H${i + 1} (${OWNERSHIP_PERCENTAGES[i]}%): ${await formatUsdc(
        balance,
      )} USDC`,
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
      if (!isImport) {
        const householdIndex = HOUSEHOLD_ADDRESSES.findIndex(
          (addr) => addr.toLowerCase() === ownerAddress.toLowerCase(),
        );
        ownerId =
          householdIndex !== -1
            ? `H${householdIndex + 1}`
            : `Unknown (${ownerAddress})`;
      }

      console.log(
        `   Batch ${i + 1}: ${energy} kWh at $${await formatUsdc(
          price,
        )}/kWh (${ownerId})`,
      );
    }
  }
  console.log(`   Total available: ${totalEnergy} kWh`);

  return isZeroSum;
}

async function runCycle(
  contract: ethers.Contract,
  cycleNumber: number,
  totalEnergyKwh: number,
  pricePerKwh: number,
) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔄 CYCLE ${cycleNumber}`);
  console.log(`${'═'.repeat(60)}`);

  // ==================== DISTRIBUTE ====================
  console.log(`\n☀️ Distribution Phase`);
  console.log('-'.repeat(50));
  console.log(
    `Distributing ${totalEnergyKwh} kWh at $${pricePerKwh}/kWh from Device 1 (H1)`,
  );

  const energySource = [
    {
      sourceId: 1, // Device 1 belongs to H1
      price: ethers.parseUnits(pricePerKwh.toString(), 6),
      quantity: totalEnergyKwh,
      isImport: false,
    },
  ];

  const distributeTx = await contract.distributeEnergyTokens(energySource, 0);
  await distributeTx.wait();
  console.log('✅ Energy distributed');

  const afterDistribution = await displaySystemState(
    contract,
    `After Distribution - Cycle ${cycleNumber}`,
  );

  // ==================== CONSUME ====================
  console.log(`\n🏠 Consumption Phase`);
  console.log('-'.repeat(50));
  console.log('All members consuming their allocated energy...');

  // Calculate allocated amounts based on ownership percentages
  const consumptionRequests = [];
  let totalAllocated = 0;

  for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
    const deviceId = i + 1; // Device IDs are 1-indexed
    let allocatedEnergy = Math.floor(
      (totalEnergyKwh * OWNERSHIP_PERCENTAGES[i]) / 100,
    );

    // Give any remainder to the last household to ensure all energy is consumed
    if (i === HOUSEHOLD_ADDRESSES.length - 1) {
      allocatedEnergy = totalEnergyKwh - totalAllocated;
    }

    consumptionRequests.push({
      deviceId: deviceId,
      quantity: allocatedEnergy,
    });
    totalAllocated += allocatedEnergy;

    console.log(
      `   H${i + 1} consuming ${allocatedEnergy} kWh (${
        OWNERSHIP_PERCENTAGES[i]
      }% of ${totalEnergyKwh} kWh)`,
    );
  }

  console.log(`   Total consumption: ${totalAllocated} kWh`);

  const consumeTx = await contract.consumeEnergyTokens(consumptionRequests);
  await consumeTx.wait();
  console.log('✅ All consumption complete');

  const afterConsumption = await displaySystemState(
    contract,
    `After Consumption - Cycle ${cycleNumber}`,
  );

  // Verify zero-sum
  if (afterConsumption) {
    console.log(`\n✨ Cycle ${cycleNumber} PASSED - Zero-sum maintained! ✨`);
  } else {
    console.log(
      `\n⚠️  Cycle ${cycleNumber} WARNING - Zero-sum violation detected!`,
    );
  }

  return afterConsumption;
}

async function runCyclicalTest() {
  console.log('🔄 CYCLICAL ENERGY DISTRIBUTION & CONSUMPTION TEST');
  console.log('==================================================');
  console.log(
    'Testing energy allocation where all members consume their share.\n',
  );

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  try {
    // ==================== INITIAL RESET ====================
    console.log('🔄 Initial System Reset');
    console.log('-'.repeat(50));
    const resetTx = await contract.emergencyReset();
    await resetTx.wait();
    console.log('✅ System reset complete');
    await displaySystemState(contract, 'Initial State (After Reset)');

    // ==================== RUN CYCLES ====================
    const numberOfCycles = 5;
    const energyConfigs = [
      { energy: 100, price: 0.1 }, // Cycle 1: 100 kWh @ $0.10/kWh
      { energy: 200, price: 0.15 }, // Cycle 2: 200 kWh @ $0.15/kWh
      { energy: 150, price: 0.12 }, // Cycle 3: 150 kWh @ $0.12/kWh
      { energy: 300, price: 0.08 }, // Cycle 4: 300 kWh @ $0.08/kWh
      { energy: 250, price: 0.2 }, // Cycle 5: 250 kWh @ $0.20/kWh
    ];

    let allCyclesPassed = true;

    for (let i = 0; i < numberOfCycles; i++) {
      const config = energyConfigs[i];
      const cyclePassed = await runCycle(
        contract,
        i + 1,
        config.energy,
        config.price,
      );
      if (!cyclePassed) {
        allCyclesPassed = false;
      }

      // Small delay between cycles
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // ==================== FINAL SUMMARY ====================
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📋 FINAL SUMMARY');
    console.log(`${'═'.repeat(60)}`);

    if (allCyclesPassed) {
      console.log('✅ ALL CYCLES PASSED!');
      console.log('✅ Zero-sum property maintained throughout all cycles.');
      console.log('✅ System is functioning correctly.');
    } else {
      console.log('❌ SOME CYCLES FAILED!');
      console.log('❌ Zero-sum violations detected.');
      console.log('❌ Please review the contract logic.');
    }

    await displaySystemState(contract, 'Final System State');

    console.log('\n🎉 CYCLICAL TEST COMPLETED!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error && typeof error === 'object' && 'reason' in error) {
      console.error('Reason:', (error as { reason: string }).reason);
    }
    throw error;
  }
}

runCyclicalTest().catch(console.error);
