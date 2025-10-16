import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Comprehensive ABI for cash flow analysis
const contractAbi = [
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
  // Events for comprehensive analysis
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'quantity',
        type: 'uint256',
      },
      { indexed: false, internalType: 'int256', name: 'cost', type: 'int256' },
    ],
    name: 'EnergyImported',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'member',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'quantity',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'int256',
        name: 'totalCost',
        type: 'int256',
      },
    ],
    name: 'EnergyConsumed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'quantity',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'int256',
        name: 'revenue',
        type: 'int256',
      },
    ],
    name: 'EnergyExported',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'sourceCount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'totalQuantity',
        type: 'uint256',
      },
    ],
    name: 'EnergyDistributed',
    type: 'event',
  },
];

async function analyzeCashFlows(): Promise<void> {
  console.log('💰 Comprehensive Cash Flow Analysis');
  console.log('===================================');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
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
    // Step 1: Current Balance Summary
    console.log('\n📊 Step 1: Current Balance Summary');
    console.log('----------------------------------');

    const householdAddresses = [
      '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a',
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    ];

    let totalHouseholdBalance = 0;
    for (let i = 0; i < householdAddresses.length; i++) {
      const balance = Number(
        (
          await energyDistribution.getCashCreditBalance(householdAddresses[i])
        )[0],
      );
      totalHouseholdBalance += balance;
      console.log(
        `  Household ${i + 1}: ${(balance / 100).toFixed(2)} USDC cents`,
      );
    }

    const communityDeviceId = await energyDistribution.getCommunityDeviceId();
    const communityAddress = await energyDistribution.getDeviceOwner(
      communityDeviceId,
    );
    const communityBalance = Number(
      (await energyDistribution.getCashCreditBalance(communityAddress))[0],
    );

    const importBalance = Number(
      await energyDistribution.getImportCashCreditBalance(),
    );
    const exportBalance = Number(
      await energyDistribution.getExportCashCreditBalance(),
    );

    console.log(
      `\n  Community Fund: ${(communityBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `  Import Balance: ${(importBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `  Export Balance: ${(exportBalance / 100).toFixed(2)} USDC cents`,
    );

    const totalSystemBalance =
      totalHouseholdBalance + communityBalance + importBalance + exportBalance;
    console.log(
      `\n  📊 TOTAL HOUSEHOLDS: ${(totalHouseholdBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );
    console.log(
      `  📊 TOTAL SYSTEM: ${(totalSystemBalance / 100).toFixed(2)} USDC cents`,
    );

    // Step 2: Transaction-by-Transaction Analysis
    console.log('\n📜 Step 2: Transaction-by-Transaction Cash Flow Analysis');
    console.log('-------------------------------------------------------');

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 400); // Reduced to 400 blocks to stay within RPC limits

    console.log(`Analyzing blocks ${fromBlock} to ${currentBlock}...`);

    // IMMEDIATE ANALYSIS BASED ON CURRENT BALANCES
    console.log('\n🔍 IMMEDIATE DISCREPANCY ANALYSIS');
    console.log('=================================');

    console.log('\n💡 THE CORE ISSUE:');
    console.log(
      `   Import Balance: +${(importBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `   This means ${(importBalance / 100).toFixed(
        2,
      )} USDC worth of imported energy was consumed`,
    );
    console.log(
      `   Members should have PAID this amount, making their balances deeply negative`,
    );

    console.log('\n📊 WHAT WE ACTUALLY SEE:');
    console.log(
      `   Total Household Balances: ${(totalHouseholdBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );
    console.log(
      `   Community Fund: +${(communityBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `   Export Balance: ${(exportBalance / 100).toFixed(2)} USDC cents`,
    );

    const expectedHouseholdBalance = -importBalance;
    const actualCombinedBalance = totalHouseholdBalance + communityBalance;
    const discrepancy = actualCombinedBalance - expectedHouseholdBalance;

    console.log('\n🧮 MATHEMATICAL ANALYSIS:');
    console.log(
      `   Expected Total Member Balance: ${(
        expectedHouseholdBalance / 100
      ).toFixed(2)} USDC cents`,
    );
    console.log(
      `   Actual Total (Households + Community): ${(
        actualCombinedBalance / 100
      ).toFixed(2)} USDC cents`,
    );
    console.log(`   DISCREPANCY: ${(discrepancy / 100).toFixed(2)} USDC cents`);

    // Check if export earnings explain the discrepancy
    const netDiscrepancyWithExports = discrepancy + exportBalance;
    console.log(
      `   Discrepancy after accounting for exports: ${(
        netDiscrepancyWithExports / 100
      ).toFixed(2)} USDC cents`,
    );

    if (Math.abs(netDiscrepancyWithExports) < Math.abs(discrepancy)) {
      console.log(
        '\n✅ PARTIAL EXPLANATION: Export earnings offset some import costs',
      );
      console.log(
        `   Export earnings reduced the discrepancy by ${(
          -exportBalance / 100
        ).toFixed(2)} USDC cents`,
      );
    }

    if (Math.abs(netDiscrepancyWithExports) > 10000) {
      // > 100 USDC
      console.log('\n🚨 MAJOR UNEXPLAINED DISCREPANCY REMAINS!');
      console.log(
        `   Even after accounting for exports, there's still ${(
          netDiscrepancyWithExports / 100
        ).toFixed(2)} USDC cents unexplained`,
      );
      console.log('\n💡 LIKELY CAUSES:');
      console.log(
        '   1. 🔋 Battery operations created/consumed energy without proper accounting',
      );
      console.log(
        '   2. 📦 Multiple energy distributions without proportional consumption',
      );
      console.log(
        '   3. 🏪 Member-to-member trading that net-positive for the community',
      );
      console.log('   4. 🐛 Potential accounting bug in the smart contract');
    }

    // Track cumulative cash flows
    let cumulativeImportRevenue = 0;
    let cumulativeExportCosts = 0;
    let cumulativeConsumptionPayments = 0;

    // Get all import events
    const importFilter = energyDistribution.filters.EnergyImported();
    const importEvents = await energyDistribution.queryFilter(
      importFilter,
      fromBlock,
      'latest',
    );

    console.log(`\n🏭 IMPORT TRANSACTIONS (${importEvents.length} total):`);
    for (const event of importEvents) {
      if ('args' in event && event.args) {
        const quantity = Number(event.args[0]);
        const cost = Number(event.args[1]);
        console.log(
          `  📦 Block ${
            event.blockNumber
          }: Imported ${quantity} kWh, potential revenue: ${(
            cost / 100
          ).toFixed(2)} USDC cents`,
        );
      }
    }

    // Get all consumption events
    const consumeFilter = energyDistribution.filters.EnergyConsumed();
    const consumeEvents = await energyDistribution.queryFilter(
      consumeFilter,
      fromBlock,
      'latest',
    );

    console.log(
      `\n🏠 CONSUMPTION TRANSACTIONS (${consumeEvents.length} total):`,
    );

    const memberConsumptionTotals: { [address: string]: number } = {};

    for (const event of consumeEvents) {
      if ('args' in event && event.args) {
        const member = event.args[0];
        const quantity = Number(event.args[1]);
        const cost = Number(event.args[2]);

        cumulativeConsumptionPayments += cost;

        if (!memberConsumptionTotals[member]) {
          memberConsumptionTotals[member] = 0;
        }
        memberConsumptionTotals[member] += cost;

        console.log(
          `  🏠 Block ${event.blockNumber}: ${member.substring(
            0,
            8,
          )}... consumed ${quantity} kWh, paid ${(cost / 100).toFixed(
            2,
          )} USDC cents`,
        );
      }
    }

    // Get all export events
    const exportFilter = energyDistribution.filters.EnergyExported();
    const exportEvents = await energyDistribution.queryFilter(
      exportFilter,
      fromBlock,
      'latest',
    );

    console.log(`\n📤 EXPORT TRANSACTIONS (${exportEvents.length} total):`);
    for (const event of exportEvents) {
      if ('args' in event && event.args) {
        const quantity = Number(event.args[0]);
        const revenue = Number(event.args[1]);
        cumulativeExportCosts += revenue; // Note: export balance goes negative, this represents what grid owes
        console.log(
          `  📤 Block ${
            event.blockNumber
          }: Exported ${quantity} kWh, revenue: ${(revenue / 100).toFixed(
            2,
          )} USDC cents`,
        );
      }
    }

    // Step 3: Cash Flow Reconciliation
    console.log('\n🔍 Step 3: Cash Flow Reconciliation');
    console.log('----------------------------------');

    console.log(
      `\n💰 Total Consumption Payments Made: ${(
        cumulativeConsumptionPayments / 100
      ).toFixed(2)} USDC cents`,
    );
    console.log(
      `📈 Current Import Balance: ${(importBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );
    console.log(
      `📉 Current Export Balance: ${(exportBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );

    console.log(`\n👥 Member Consumption Breakdown:`);
    for (let i = 0; i < householdAddresses.length; i++) {
      const addr = householdAddresses[i];
      const totalPaid = memberConsumptionTotals[addr] || 0;
      const currentBalance = Number(
        (await energyDistribution.getCashCreditBalance(addr))[0],
      );
      console.log(
        `  Household ${i + 1}: Paid ${(totalPaid / 100).toFixed(
          2,
        )}, Current Balance: ${(currentBalance / 100).toFixed(2)} USDC cents`,
      );
    }

    // Step 4: Identify the Discrepancy
    console.log('\n❌ Step 4: Discrepancy Analysis');
    console.log('-------------------------------');

    console.log(`Expected household balance if only import consumption:`);
    console.log(
      `  Import Balance: +${(importBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `  Expected Member Total: -${(importBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );
    console.log(
      `  Actual Member Total: ${(totalHouseholdBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );
    console.log(
      `  Discrepancy: ${((totalHouseholdBalance + importBalance) / 100).toFixed(
        2,
      )} USDC cents`,
    );

    const discrepancy = totalHouseholdBalance + importBalance;

    if (Math.abs(discrepancy) > 100) {
      // More than 1 USDC cent
      console.log(
        `\n🚨 MAJOR DISCREPANCY DETECTED: ${(discrepancy / 100).toFixed(
          2,
        )} USDC cents`,
      );
      console.log(`\n💡 Possible explanations:`);
      console.log(`   1. Export earnings offsetting import costs`);
      console.log(`   2. Member-to-member energy trading`);
      console.log(`   3. Battery operations affecting balances`);
      console.log(`   4. Self-consumption payments to community fund`);
      console.log(`   5. Energy distributed but not fully consumed`);

      // Check if exports explain the discrepancy
      if (Math.abs(discrepancy + exportBalance) < 100) {
        console.log(
          `\n✅ LIKELY EXPLANATION: Export earnings offset import costs`,
        );
        console.log(
          `   Export balance: ${(exportBalance / 100).toFixed(2)} USDC cents`,
        );
        console.log(
          `   This balances the equation: households earned from exports what they paid for imports`,
        );
      }

      // Check community fund
      if (communityBalance > 100000) {
        // > 1000 USDC cents
        console.log(`\n💡 CONTRIBUTING FACTOR: Large community fund balance`);
        console.log(`   Community receives payments from self-consumption`);
        console.log(`   This adds to the total member balance pool`);
      }
    } else {
      console.log(`\n✅ Minor discrepancy within acceptable rounding error`);
    }

    // Step 5: Zero-Sum Verification with Full Context
    console.log('\n🎯 Step 5: Zero-Sum Verification with Full Context');
    console.log('-------------------------------------------------');

    console.log(`All cash flows should sum to zero:`);
    console.log(
      `  All Households: ${(totalHouseholdBalance / 100).toFixed(
        2,
      )} USDC cents`,
    );
    console.log(
      `  Community Fund: ${(communityBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `  Import Balance: ${(importBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(
      `  Export Balance: ${(exportBalance / 100).toFixed(2)} USDC cents`,
    );
    console.log(`  ────────────────────────────────────────────────────`);
    console.log(`  TOTAL: ${(totalSystemBalance / 100).toFixed(2)} USDC cents`);

    if (Math.abs(totalSystemBalance) < 100) {
      console.log(`\n✅ ZERO-SUM PROPERTY MAINTAINED (within rounding error)`);
    } else {
      console.log(
        `\n❌ ZERO-SUM PROPERTY VIOLATED by ${(
          totalSystemBalance / 100
        ).toFixed(2)} USDC cents`,
      );
    }
  } catch (error) {
    console.error('❌ Cash flow analysis failed:', error);
  }
}

async function main(): Promise<void> {
  await analyzeCashFlows();
}

main().catch(console.error);

export { analyzeCashFlows };
