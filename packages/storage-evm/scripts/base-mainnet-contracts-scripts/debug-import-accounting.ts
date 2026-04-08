import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// ABI for debugging import accounting
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
  // Events for transaction analysis
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

async function debugImportAccounting(): Promise<void> {
  console.log('🔍 Import Accounting Debug Analysis');
  console.log('==================================');

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
    // Step 1: Current balances
    console.log('\n💰 Step 1: Current System Balances');
    console.log('----------------------------------');

    const importBalance = Number(
      await energyDistribution.getImportCashCreditBalance(),
    );
    const exportBalance = Number(
      await energyDistribution.getExportCashCreditBalance(),
    );

    console.log(
      `Import Balance: ${
        importBalance / 100
      } USDC cents (${importBalance} raw)`,
    );
    console.log(
      `Export Balance: ${
        exportBalance / 100
      } USDC cents (${exportBalance} raw)`,
    );

    // Step 2: Collective Consumption Analysis
    console.log('\n📊 Step 2: Collective Consumption Pool Analysis');
    console.log('-----------------------------------------------');

    const collectiveConsumption =
      await energyDistribution.getCollectiveConsumption();
    console.log(
      `Total items in collective pool: ${collectiveConsumption.length}`,
    );

    let totalImportQuantity = 0;
    let totalImportValue = 0;
    let totalMemberQuantity = 0;
    let totalMemberValue = 0;
    let totalBatteryQuantity = 0;
    let totalBatteryValue = 0;

    console.log('\nCollective Consumption Breakdown:');

    for (let i = 0; i < collectiveConsumption.length; i++) {
      const item = collectiveConsumption[i];
      const owner = item.owner;
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      const value = price * quantity;

      if (owner === '0x0000000000000000000000000000000000000000') {
        // Import energy (community-owned)
        totalImportQuantity += quantity;
        totalImportValue += value;
        console.log(
          `  🏭 Import: ${quantity} kWh @ $${(price / 100).toFixed(
            2,
          )}/kWh = $${(value / 100).toFixed(2)}`,
        );
      } else if (owner === '0x0000000000000000000000000000000003e7') {
        // 999 in hex
        // Battery discharge (special ID 999)
        totalBatteryQuantity += quantity;
        totalBatteryValue += value;
        console.log(
          `  🔋 Battery: ${quantity} kWh @ $${(price / 100).toFixed(
            2,
          )}/kWh = $${(value / 100).toFixed(2)}`,
        );
      } else {
        // Member-owned energy
        totalMemberQuantity += quantity;
        totalMemberValue += value;
        console.log(
          `  👤 Member (${owner.substring(0, 6)}...): ${quantity} kWh @ $${(
            price / 100
          ).toFixed(2)}/kWh = $${(value / 100).toFixed(2)}`,
        );
      }
    }

    console.log('\n📈 Pool Summary:');
    console.log(
      `  🏭 Available Import Energy: ${totalImportQuantity} kWh worth $${(
        totalImportValue / 100
      ).toFixed(2)}`,
    );
    console.log(
      `  👤 Available Member Energy: ${totalMemberQuantity} kWh worth $${(
        totalMemberValue / 100
      ).toFixed(2)}`,
    );
    console.log(
      `  🔋 Available Battery Energy: ${totalBatteryQuantity} kWh worth $${(
        totalBatteryValue / 100
      ).toFixed(2)}`,
    );
    console.log(
      `  📊 Total Available: ${
        totalImportQuantity + totalMemberQuantity + totalBatteryQuantity
      } kWh worth $${(
        (totalImportValue + totalMemberValue + totalBatteryValue) /
        100
      ).toFixed(2)}`,
    );

    // Step 3: Import Balance Analysis
    console.log('\n🔍 Step 3: Import Balance vs Available Import Energy');
    console.log('---------------------------------------------------');

    console.log(`Current Import Balance: ${importBalance / 100} USDC cents`);
    console.log(
      `Remaining Import Energy Value: ${totalImportValue / 100} USDC cents`,
    );

    const consumedImportValue = importBalance - totalImportValue;
    console.log(
      `Consumed Import Energy Value: ${consumedImportValue / 100} USDC cents`,
    );

    if (consumedImportValue > 0) {
      console.log(
        `\n💡 Analysis: ${(consumedImportValue / 100).toFixed(
          2,
        )} USDC worth of import energy has been consumed`,
      );
      console.log(`   This explains why importCashCreditBalance is positive.`);
    } else {
      console.log(
        `\n⚠️  Warning: Import balance calculation doesn't match available energy`,
      );
    }

    // Step 4: Recent Transaction Analysis
    console.log('\n📜 Step 4: Recent Transaction History');
    console.log('------------------------------------');

    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Last ~1000 blocks

      console.log(`Analyzing blocks ${fromBlock} to ${currentBlock}...`);

      // Get Energy Import events
      const importFilter = energyDistribution.filters.EnergyImported();
      const importEvents = await energyDistribution.queryFilter(
        importFilter,
        fromBlock,
        'latest',
      );
      console.log(`\n🏭 Import Events (${importEvents.length}):`);

      let totalImported = 0;
      let totalImportCost = 0;

      for (const event of importEvents.slice(-5)) {
        // Show last 5
        if ('args' in event && event.args) {
          const quantity = Number(event.args[0]);
          const cost = Number(event.args[1]);
          totalImported += quantity;
          totalImportCost += cost;
          console.log(
            `  📦 Imported ${quantity} kWh at cost ${
              cost / 100
            } USDC cents (Block: ${event.blockNumber})`,
          );
        }
      }

      if (importEvents.length > 5) {
        console.log(`  ... and ${importEvents.length - 5} more import events`);
      }

      // Get Energy Consumption events
      const consumeFilter = energyDistribution.filters.EnergyConsumed();
      const consumeEvents = await energyDistribution.queryFilter(
        consumeFilter,
        fromBlock,
        'latest',
      );
      console.log(`\n🏠 Consumption Events (${consumeEvents.length}):`);

      let totalConsumed = 0;
      let totalConsumptionCost = 0;

      for (const event of consumeEvents.slice(-5)) {
        // Show last 5
        if ('args' in event && event.args) {
          const member = event.args[0];
          const quantity = Number(event.args[1]);
          const cost = Number(event.args[2]);
          totalConsumed += quantity;
          totalConsumptionCost += cost;
          console.log(
            `  🏠 ${member.substring(
              0,
              8,
            )}... consumed ${quantity} kWh at cost ${
              cost / 100
            } USDC cents (Block: ${event.blockNumber})`,
          );
        }
      }

      if (consumeEvents.length > 5) {
        console.log(
          `  ... and ${consumeEvents.length - 5} more consumption events`,
        );
      }

      console.log(`\n📊 Recent Activity Summary:`);
      console.log(
        `  Total Imported: ${totalImported} kWh worth ${
          totalImportCost / 100
        } USDC cents`,
      );
      console.log(
        `  Total Consumed: ${totalConsumed} kWh worth ${
          totalConsumptionCost / 100
        } USDC cents`,
      );
    } catch (error) {
      console.log('⚠️  Could not analyze transaction history:', error.message);
    }

    // Step 5: Diagnosis
    console.log('\n🎯 Step 5: Diagnosis & Recommendations');
    console.log('-------------------------------------');

    if (importBalance > 1000000) {
      // > 10,000 USDC cents
      console.log('❌ ISSUE: Very large import balance detected');
      console.log('   This suggests extensive import energy consumption.');
      console.log('');
      console.log('💡 Possible causes:');
      console.log(
        '   1. Multiple simulation runs accumulated import consumption',
      );
      console.log(
        '   2. Large quantities of expensive imported energy were consumed',
      );
      console.log('   3. Import energy was distributed multiple times');
      console.log('');
      console.log('🔧 Solutions:');
      console.log('   1. Deploy a fresh contract for clean testing');
      console.log('   2. Use smaller import quantities in simulations');
      console.log('   3. Track cumulative effects across multiple runs');
    } else {
      console.log('✅ Import balance appears reasonable for testing');
    }
  } catch (error) {
    console.error('❌ Debug analysis failed:', error);
  }
}

async function main(): Promise<void> {
  await debugImportAccounting();
}

main().catch(console.error);

export { debugImportAccounting };
