import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Minimal ABI for debugging
const debugAbi = [
  {
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getAllocatedTokens',
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
];

const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1: 30%
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2: 25%
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3: 20%
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4: 15%
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5: 10%
];

async function debugEnergyTokens(): Promise<void> {
  console.log('🔍 Energy Tokens Debug Tool');
  console.log('Analyzing available energy tokens and collective pool');
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    debugAbi,
    provider,
  );

  try {
    // Step 1: Check individual household allocated tokens
    console.log('🏠 Individual Household Allocated Tokens:');
    let totalAllocatedTokens = 0;

    for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
      const address = HOUSEHOLD_ADDRESSES[i];
      try {
        const allocatedTokens = await energyDistribution.getAllocatedTokens(
          address,
        );
        const tokens = Number(allocatedTokens);
        totalAllocatedTokens += tokens;

        console.log(`   Household ${i + 1} (${address}): ${tokens} kWh`);
      } catch (error) {
        console.log(`   Household ${i + 1}: Unable to fetch (RPC issue)`);
      }
    }

    console.log(`📊 Total Allocated Tokens: ${totalAllocatedTokens} kWh\n`);

    // Step 2: Check collective consumption pool
    console.log('🌊 Collective Consumption Pool:');

    try {
      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();

      if (collectiveConsumption.length === 0) {
        console.log(
          '   ❌ Pool is EMPTY - no energy tokens available for consumption!',
        );
        console.log('   💡 You need to run energy production first.');
      } else {
        console.log(
          `   📋 Found ${collectiveConsumption.length} energy batches:`,
        );

        let totalAvailableEnergy = 0;

        collectiveConsumption.forEach((item, index) => {
          const quantity = Number(item.quantity);
          const price = Number(item.price);
          const owner = item.owner;

          totalAvailableEnergy += quantity;

          console.log(`      Batch ${index + 1}:`);
          console.log(`         - Quantity: ${quantity} kWh`);
          console.log(
            `         - Price: ${ethers.formatUnits(price, 6)} USDC/kWh`,
          );
          console.log(
            `         - Owner: ${
              owner === '0x0000000000000000000000000000000000000000'
                ? 'Community (Import)'
                : owner
            }`,
          );
        });

        console.log(
          `   📊 Total Available Energy: ${totalAvailableEnergy} kWh`,
        );

        // Check if there's enough for the planned consumption
        const plannedConsumption = 60 + 40 + 80 + 30 + 20 + 20; // 250 kWh
        console.log(`   🎯 Planned Consumption: ${plannedConsumption} kWh`);

        if (totalAvailableEnergy >= plannedConsumption) {
          console.log(`   ✅ Sufficient energy available!`);
        } else {
          console.log(
            `   ❌ Insufficient energy! Short by ${
              plannedConsumption - totalAvailableEnergy
            } kWh`,
          );
        }
      }
    } catch (error) {
      console.log(`   ❌ Unable to fetch collective pool: ${error.message}`);
    }

    // Step 3: Check battery state
    console.log('\n🔋 Battery Information:');
    try {
      const batteryInfo = await energyDistribution.getBatteryInfo();
      console.log(`   - Current State: ${batteryInfo.currentState} kWh`);
      console.log(`   - Max Capacity: ${batteryInfo.maxCapacity} kWh`);
      console.log(`   - Configured: ${batteryInfo.configured}`);
      console.log(
        `   - Price: ${ethers.formatUnits(batteryInfo.price, 6)} USDC/kWh`,
      );
    } catch (error) {
      console.log(`   ❌ Unable to fetch battery info: ${error.message}`);
    }

    // Step 4: Recommendations
    console.log('\n💡 Recommendations:');

    if (totalAllocatedTokens === 0) {
      console.log(
        "1. ❌ No allocated tokens found - energy production hasn't been run",
      );
      console.log('   🔧 Solution: Run full energy simulation first');
      console.log('   📝 Command: npm run energy-simulation');
    } else {
      console.log(
        '1. ✅ Some allocated tokens found, but may not be in collective pool yet',
      );
    }

    console.log('2. 🔍 Check if previous production was consumed already');
    console.log(
      '3. 🔄 Try running production step to generate fresh energy tokens',
    );
    console.log(
      '4. 📉 Alternatively, reduce consumption amounts to match available energy',
    );
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

async function main(): Promise<void> {
  await debugEnergyTokens();
}

main().catch(console.error);

export { debugEnergyTokens };
