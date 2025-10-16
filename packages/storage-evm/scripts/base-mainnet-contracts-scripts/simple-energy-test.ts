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
    name: 'getCommunityCashCreditBalance',
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
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1 (30% ownership)
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2 (25% ownership)
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3 (20% ownership)
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4 (15% ownership)
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5 (10% ownership)
];

const OWNERSHIP_PERCENTAGES = [30, 25, 20, 15, 10];

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

  const [isZeroSum, contractBalance] = await contract.verifyZeroSumProperty();
  console.log('\n🔍 Zero-Sum Verification:');
  console.log(
    `   Contract result: ${isZeroSum ? 'PASS' : 'FAIL'} (${await formatUsdc(
      contractBalance,
    )} USDC)`,
  );
  if (!isZeroSum) {
    console.log(`   Status: ❌ VIOLATION`);
  } else {
    console.log(`   Status: ✅ PERFECT ZERO-SUM`);
  }

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
}

async function runSimpleTest() {
  console.log('🧪 SIMPLE ENERGY SYSTEM TEST');
  console.log('=============================');
  console.log('Testing core functionalities in isolation.\n');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  try {
    // ==================== STEP 1: RESET ====================
    console.log('🔄 STEP 1: Resetting contract state');
    console.log('-'.repeat(50));
    const resetTx = await contract.emergencyReset();
    await resetTx.wait();
    console.log('✅ System reset complete');
    await displaySystemState(contract, 'After Reset');

    // ==================== STEP 2: DISTRIBUTE LOCAL ENERGY ====================
    console.log('\n☀️ STEP 2: Distributing local energy (Solar)');
    console.log('-'.repeat(50));
    const solarSource = [
      {
        sourceId: 1,
        price: ethers.parseUnits('0.10', 6), // 10 cents/kWh
        quantity: 100, // 100 kWh
        isImport: false,
      },
    ];
    console.log('⏳ Distributing 100 kWh of solar...');
    const distributeTx = await contract.distributeEnergyTokens(solarSource, 0);
    await distributeTx.wait();
    console.log('✅ Energy distributed');
    await displaySystemState(contract, 'After Solar Distribution');

    // ==================== STEP 3: SELF-CONSUMPTION ====================
    console.log('\n🏠 STEP 3: Pure Self-Consumption');
    console.log('-'.repeat(50));
    // H1 has 30% ownership -> 30kWh of solar. Let's consume 10kWh.
    const selfConsumption = [{ deviceId: 1, quantity: 10 }];
    console.log('⏳ H1 consuming 10 kWh of its own solar...');
    const selfConsumeTx = await contract.consumeEnergyTokens(selfConsumption);
    await selfConsumeTx.wait();
    console.log('✅ Self-consumption complete');
    await displaySystemState(contract, 'After Self-Consumption');

    // ==================== STEP 4: CROSS-MEMBER TRADING ====================
    console.log('\n🤝 STEP 4: Cross-Member Trading');
    console.log('-'.repeat(50));
    // H2 has 25kWh. It will consume its 25kWh and 5kWh from another member.
    const crossMemberConsumption = [{ deviceId: 2, quantity: 30 }];
    console.log('⏳ H2 consuming 30 kWh (25 own, 5 from others)...');
    const crossConsumeTx = await contract.consumeEnergyTokens(
      crossMemberConsumption,
    );
    await crossConsumeTx.wait();
    console.log('✅ Cross-member trading complete');
    await displaySystemState(contract, 'After Cross-Member Trading');

    // ==================== STEP 5: IMPORT & CONSUMPTION ====================
    console.log('\n🔌 STEP 5: Energy Import & Consumption');
    console.log('-'.repeat(50));
    await (await contract.emergencyReset()).wait(); // Reset for clean import test
    console.log('✅ System reset for import test');
    const importSource = [
      {
        sourceId: 10,
        price: ethers.parseUnits('0.30', 6), // 30 cents/kWh
        quantity: 50, // 50 kWh
        isImport: true,
      },
    ];
    console.log('⏳ Distributing 50 kWh of imported energy...');
    const importDistributeTx = await contract.distributeEnergyTokens(
      importSource,
      0,
    );
    await importDistributeTx.wait();
    console.log('✅ Imported energy distributed');
    await displaySystemState(contract, 'After Import Distribution');

    const importConsumption = [{ deviceId: 4, quantity: 15 }];
    console.log('⏳ H4 consuming 15 kWh of imported energy...');
    const importConsumeTx = await contract.consumeEnergyTokens(
      importConsumption,
    );
    await importConsumeTx.wait();
    console.log('✅ Import consumption complete');
    await displaySystemState(contract, 'After Import Consumption');

    // ==================== STEP 6: EXPORT ====================
    console.log('\n📤 STEP 6: Energy Export');
    console.log('-'.repeat(50));
    await (await contract.emergencyReset()).wait(); // Reset for clean export test
    console.log('✅ System reset for export test');
    console.log('⏳ Distributing 100 kWh of solar for export...');
    await (await contract.distributeEnergyTokens(solarSource, 0)).wait();
    await displaySystemState(contract, 'Fresh Energy for Export');

    const exportPrice = ethers.parseUnits('0.12', 6);
    console.log('⏳ Setting export price to $0.12/kWh...');
    await (await contract.setExportPrice(exportPrice)).wait();
    console.log('✅ Export price set');

    const exportDeviceId = await contract.getExportDeviceId();
    const exportRequest = [{ deviceId: Number(exportDeviceId), quantity: 80 }];
    console.log('⏳ Exporting 80 kWh of solar...');
    const exportTx = await contract.consumeEnergyTokens(exportRequest);
    await exportTx.wait();
    console.log('✅ Export complete');
    await displaySystemState(contract, 'After Export');

    console.log('\n🎉 SIMPLE TEST COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error && typeof error === 'object' && 'reason' in error) {
      console.error('Reason:', (error as { reason: string }).reason);
    }
  }
}

runSimpleTest().catch(console.error);
