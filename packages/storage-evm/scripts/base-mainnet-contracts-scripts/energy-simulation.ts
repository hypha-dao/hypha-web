import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Complete contract ABI with all functions needed for simulation
const energyDistributionAbi = [
  // Configuration functions
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
  // Core energy functions
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
  // View functions
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
    inputs: [
      { internalType: 'address', name: 'memberAddress', type: 'address' },
    ],
    name: 'getMember',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'memberAddress', type: 'address' },
          { internalType: 'uint256[]', name: 'deviceIds', type: 'uint256[]' },
          {
            internalType: 'uint256',
            name: 'ownershipPercentage',
            type: 'uint256',
          },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct IEnergyDistribution.Member',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getAllocatedTokens',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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
    name: 'getTotalOwnershipPercentage',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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
    inputs: [],
    name: 'getContractVersion',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'totalSources',
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
        name: 'cashCreditBalance',
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
        name: 'totalQuantity',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'int256',
        name: 'exportValue',
        type: 'int256',
      },
    ],
    name: 'EnergyExported',
    type: 'event',
  },
];

// Household addresses from our configuration
const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1: 30%
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2: 25%
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3: 20%
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4: 15%
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5: 10%
];

const DEVICE_IDS = [1, 2, 3, 4, 5]; // Corresponding device IDs
const EXPORT_DEVICE_ID = 1000;
const COMMUNITY_DEVICE_ID = 1001;

async function runEnergySimulation(
  skipProduction: boolean = false,
): Promise<void> {
  console.log('⚡ Energy Distribution Simulation');
  console.log('🏘️ 5-Household Community Energy Management');
  if (skipProduction) {
    console.log('🎯 Mode: Consumption Only (skipping production)');
  }
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load wallet
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      const parsedData = JSON.parse(data);
      // Filter out placeholder entries
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
    // Check contract version
    try {
      const version = await (energyDistribution as any).getContractVersion();
      console.log(`🔢 Contract Version: ${version}`);
      if (version.toString() === '2') {
        console.log('✅ Running UPGRADED contract with batched payment fix!\n');
      } else {
        console.log('⚠️  Running OLD contract version (pre-fix)\n');
      }
    } catch (error) {
      console.log('⚠️  Contract version check failed - running OLD contract (pre-fix)\n');
    }

    // Step 1: Display initial state
    console.log('📊 STEP 1: Current Contract State');
    console.log('-'.repeat(50));
    await displayContractState(energyDistribution, 'Current');

    if (!skipProduction) {
      // Step 2: Energy Production & Distribution
      console.log('\n⚡ STEP 2: Energy Production & Distribution');
      console.log('-'.repeat(50));
      console.log('🌞 Simulating daily energy production...');

      // Define energy sources for a typical day
      const energySources = [
        {
          sourceId: 1, // Solar production
          price: ethers.parseUnits('0.10', 6), // 0.10 USDC per kWh
          quantity: 200, // 200 kWh solar production
          isImport: false,
        },
        // TEMPORARILY REMOVED: Grid import to test pure self-consumption
        // {
        //   sourceId: 2, // Grid import (needed during peak demand)
        //   price: ethers.parseUnits('0.30', 6), // 0.30 USDC per kWh (more expensive)
        //   quantity: 50, // 50 kWh grid import
        //   isImport: true,
        // },
      ];

      const batteryState = 80; // Battery charged to 80 kWh (from previous day)

      console.log('📋 Energy Sources:');
      energySources.forEach((source, index) => {
        console.log(
          `   ${index + 1}. ${
            source.isImport ? 'Grid Import' : 'Solar Production'
          }`,
        );
        console.log(`      - Quantity: ${source.quantity} kWh`);
        console.log(
          `      - Price: ${ethers.formatUnits(source.price, 6)} USDC/kWh`,
        );
      });
      console.log(`🔋 Battery State: ${batteryState} kWh\n`);

      console.log('⏳ Distributing energy to households...');
      const distributeTx = await energyDistribution.distributeEnergyTokens(
        energySources,
        batteryState,
      );
      console.log(`📝 Distribution transaction: ${distributeTx.hash}`);
      await distributeTx.wait();
      console.log('✅ Energy distribution completed!\n');

      // Step 3: Display post-distribution state
      console.log('📊 STEP 3: Post-Distribution State');
      console.log('-'.repeat(50));
      await displayContractState(energyDistribution, 'Post-Distribution');
    } else {
      console.log(
        '\n⏭️  Skipping production step (using existing energy tokens)',
      );
    }

    // Step 4: Energy Consumption
    const stepNumber = skipProduction ? 2 : 4;
    console.log(`\n🏠 STEP ${stepNumber}: Household Energy Consumption`);
    console.log('-'.repeat(50));
    console.log('💡 Simulating household energy usage...');

    // Define consumption requests - BALANCED to consume ALL distributed energy
    // Distributed: 120 kWh total (200 solar - 80 battery charge)
    // Breakdown by ownership:
    //   H1 (30%): 36 kWh
    //   H2 (25%): 30 kWh
    //   H3 (20%): 24 kWh
    //   H4 (15%): 18 kWh
    //   H5 (10%): 12 kWh
    // ✅ Strategy: Each household consumes exactly what they own (100% self-consumption)
    // ✅ This creates self-consumption payments: Member → Community (maintains zero-sum)
    // ✅ All distributed energy is consumed, allowing next distribution cycle
    const consumptionRequests = [
      { deviceId: 1, quantity: 36 }, // Household 1: consumes all 36 kWh
      { deviceId: 2, quantity: 30 }, // Household 2: consumes all 30 kWh
      { deviceId: 3, quantity: 24 }, // Household 3: consumes all 24 kWh
      { deviceId: 4, quantity: 18 }, // Household 4: consumes all 18 kWh
      { deviceId: 5, quantity: 12 }, // Household 5: consumes all 12 kWh
      // Total: 120 kWh - matches distributed amount exactly
    ];

    console.log('📋 Consumption Requests:');
    consumptionRequests.forEach((request, index) => {
      if (request.deviceId === EXPORT_DEVICE_ID) {
        console.log(`   ${index + 1}. Export to Grid: ${request.quantity} kWh`);
      } else {
        const householdNum = DEVICE_IDS.indexOf(request.deviceId) + 1;
        console.log(
          `   ${index + 1}. Household ${householdNum}: ${request.quantity} kWh`,
        );
      }
    });

    const totalConsumption = consumptionRequests.reduce(
      (sum, req) => sum + req.quantity,
      0,
    );
    console.log(`📊 Total Consumption: ${totalConsumption} kWh\n`);

    console.log('⏳ Processing energy consumption...');
    const consumeTx = await energyDistribution.consumeEnergyTokens(
      consumptionRequests,
    );
    console.log(`📝 Consumption transaction: ${consumeTx.hash}`);
    await consumeTx.wait();
    console.log('✅ Energy consumption completed!\n');

    // Step 5: Final verification
    const finalStepNumber = skipProduction ? 3 : 5;
    console.log(`🔍 STEP ${finalStepNumber}: Final Verification & Results`);
    console.log('-'.repeat(50));
    await displayContractState(energyDistribution, 'Final');

    // Step 6: Transaction analysis
    const analysisStepNumber = skipProduction ? 4 : 6;
    console.log(`\n📈 STEP ${analysisStepNumber}: Transaction Analysis`);
    console.log('-'.repeat(50));
    await analyzeTransactionEvents(consumeTx, energyDistribution);

    console.log('\n🎉 Energy Simulation Completed Successfully!');
    if (skipProduction) {
      console.log('✅ The energy consumption system is working perfectly!');
      console.log('🏘️ Community address setup was successful!');
    } else {
      console.log('✅ The energy distribution system is working perfectly!');
      console.log('💡 Households can now trade energy efficiently and fairly.');
    }
  } catch (error) {
    console.error('\n❌ Simulation failed:', error);
    if (error instanceof Error) {
      if (error.message.includes('revert')) {
        console.log(
          '💡 This might be due to insufficient energy tokens or other business logic constraints.',
        );
      }
      if (error.message.includes('Community address not set')) {
        console.log(
          '💡 Run: npm run setup-community to fix the community address issue.',
        );
      }
    }
  }
}

async function displayContractState(
  contract: ethers.Contract,
  phase: string,
): Promise<void> {
  console.log(`📊 Contract State - ${phase}:`);

  try {
    // Battery info
    const batteryInfo = await contract.getBatteryInfo();
    console.log(
      `🔋 Battery: ${batteryInfo.currentState} kWh / ${batteryInfo.maxCapacity} kWh`,
    );

    // Total ownership
    const totalOwnership = await contract.getTotalOwnershipPercentage();
    console.log(`👥 Total Ownership: ${Number(totalOwnership) / 100}%`);

    // Cash Credit Balance Verification - Initialize totals
    let totalHouseholdBalance = 0;
    let importBalance = 0;
    let exportBalance = 0;

    // Export/Import balances
    try {
      exportBalance = Number(await contract.getExportCashCreditBalance());
      importBalance = Number(await contract.getImportCashCreditBalance());
      console.log(
        `💰 Export Balance: ${
          exportBalance / 100
        } USDC cents (${exportBalance} raw)`,
      );
      console.log(
        `💰 Import Balance: ${
          importBalance / 100
        } USDC cents (${importBalance} raw)`,
      );
    } catch (error) {
      console.log(`💰 Export/Import Balances: Unable to fetch data`);
    }

    // Household details
    console.log(`🏠 Household Details:`);
    for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
      const address = HOUSEHOLD_ADDRESSES[i];
      try {
        const member = await contract.getMember(address);
        const allocatedTokens = await contract.getAllocatedTokens(address);
        const cashBalance = Number(
          await contract.getCashCreditBalance(address),
        );
        totalHouseholdBalance += cashBalance;

        console.log(`   Household ${i + 1} (${address}):`);
        console.log(
          `     - Ownership: ${Number(member.ownershipPercentage) / 100}%`,
        );
        console.log(`     - Allocated Tokens: ${Number(allocatedTokens)} kWh`);
        console.log(
          `     - Cash Balance: ${
            cashBalance / 100
          } USDC cents (${cashBalance} raw)`,
        );
      } catch (error) {
        console.log(`   Household ${i + 1}: Unable to fetch data`);
      }
    }

    // Community Address (receives import/self-consumption payments)
    try {
      const communityDeviceId = await contract.getCommunityDeviceId();
      const communityAddress = await contract.getDeviceOwner(communityDeviceId);
      if (
        communityAddress &&
        communityAddress !== '0x0000000000000000000000000000000000000000'
      ) {
        const communityBalance = Number(
          await contract.getCashCreditBalance(communityAddress),
        );
        totalHouseholdBalance += communityBalance;

        console.log(`\n🏘️ Community Address (${communityAddress}):`);
        console.log(
          `     - Role: Receives self-consumption payments & import overcharges`,
        );
        console.log(`     - Critical for zero-sum accounting`);
        console.log(
          `     - Cash Balance: ${
            communityBalance / 100
          } USDC cents (${communityBalance} raw)`,
        );
      }
    } catch (error) {
      console.log(`\n🏘️ Community Address: Unable to fetch data`);
    }

    // Cash Credit Balance Verification
    console.log(`\n💰 ZERO-SUM ACCOUNTING VERIFICATION:`);
    console.log(`════════════════════════════════════════════════════════════`);
    console.log(`📊 MEMBER BALANCES (internal trading):`);
    console.log(
      `   Total Household + Community: ${
        totalHouseholdBalance / 100
      } USDC cents (${totalHouseholdBalance} raw)`,
    );
    console.log(
      `   💡 Includes community balance receiving self-consumption payments`,
    );

    console.log(`\n🌐 EXTERNAL GRID RELATIONSHIPS:`);
    console.log(
      `   Export Balance: ${
        exportBalance / 100
      } USDC cents (Grid owes community: ${exportBalance} raw)`,
    );
    console.log(
      `   Import Balance: ${
        importBalance / 100
      } USDC cents (Community owes grid: ${importBalance} raw)`,
    );

    const totalSystemBalance =
      totalHouseholdBalance + exportBalance + importBalance;
    console.log(`\n🔍 ZERO-SUM VERIFICATION:`);
    console.log(
      `   All Households + Community: ${
        totalHouseholdBalance / 100
      } USDC cents`,
    );
    console.log(
      `   Export Balance:             ${exportBalance / 100} USDC cents`,
    );
    console.log(
      `   Import Balance:             ${importBalance / 100} USDC cents`,
    );
    console.log(
      `   ──────────────────────────────────────────────────────────────`,
    );
    console.log(
      `   TOTAL SUM:                  ${
        totalSystemBalance / 100
      } USDC cents (${totalSystemBalance} raw)`,
    );

    if (totalSystemBalance === 0) {
      console.log(
        `   ✅ PERFECT! Zero-sum property maintained - all balances sum to ZERO`,
      );
      console.log(`   ✅ System accounting is mathematically correct!`);
    } else {
      console.log(
        `   ❌ WARNING! Zero-sum property violated - total should be 0 but is ${totalSystemBalance}`,
      );
      console.log(
        `   🔍 This indicates an accounting error in the energy trading system`,
      );
    }

    console.log(`\n💡 HOW ZERO-SUM ACCOUNTING WORKS:`);
    console.log(
      `   1. Self-consumption: Member balance ↓, Community balance ↑`,
    );
    console.log(`   2. Peer trading: Seller balance ↑, Buyer balance ↓`);
    console.log(`   3. Import: Energy available (no cash flow)`);
    console.log(
      `   4. Import consumption: Member balance ↓, Import cash balance ↑`,
    );
    console.log(`   5. Export sales: Token owner balance ↑, Export balance ↓`);
    console.log(`   6. Result: All flows net to exactly ZERO`);

    // Collective consumption pool
    try {
      const collectiveConsumption = await contract.getCollectiveConsumption();
      console.log(
        `\n🌊 Collective Pool: ${collectiveConsumption.length} energy batches available`,
      );
      let totalPoolEnergy = 0;
      collectiveConsumption.forEach((item: any, index: number) => {
        const quantity = Number(item.quantity);
        totalPoolEnergy += quantity;
        if (quantity > 0) {
          console.log(
            `     Batch ${index + 1}: ${quantity} kWh at ${ethers.formatUnits(
              item.price,
              6,
            )} USDC/kWh`,
          );
        }
      });
      console.log(`     Total Pool Energy: ${totalPoolEnergy} kWh`);
    } catch (error) {
      console.log(`🌊 Collective Pool: Unable to fetch data`);
    }
  } catch (error) {
    console.log(
      `❌ Error displaying state: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log(''); // Empty line
}

async function analyzeTransactionEvents(
  tx: ethers.TransactionResponse,
  contract: ethers.Contract,
): Promise<void> {
  console.log('🔍 Analyzing transaction events...');

  try {
    const receipt = await tx.wait();
    if (!receipt) {
      console.log('❌ No transaction receipt found');
      return;
    }

    console.log(`📋 Transaction Details:`);
    console.log(`   - Block: ${receipt.blockNumber}`);
    console.log(`   - Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   - Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);

    // Parse events
    const events = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .filter((event) => event !== null);

    console.log(`\n📡 Events Emitted: ${events.length}`);

    events.forEach((event, index) => {
      console.log(`\n   Event ${index + 1}: ${event.name}`);

      if (event.name === 'EnergyConsumed') {
        const member = event.args[0];
        const quantity = Number(event.args[1]);
        const costPaid = Number(event.args[2]);
        console.log(`     - Member: ${member}`);
        console.log(`     - Consumed: ${quantity} kWh`);
        console.log(`     - Cost Paid: ${costPaid / 100} USDC cents`);
      } else if (event.name === 'EnergyExported') {
        const quantity = Number(event.args[0]);
        const value = Number(event.args[1]);
        console.log(`     - Exported: ${quantity} kWh`);
        console.log(`     - Export Value: ${value / 100} USDC cents`);
      } else {
        console.log(
          `     - Args: ${event.args.map((arg) => arg.toString()).join(', ')}`,
        );
      }
    });
  } catch (error) {
    console.log(
      `❌ Error analyzing events: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';

  switch (mode.toLowerCase()) {
    case 'consumption':
    case 'consume':
    case 'c':
      await runEnergySimulation(true); // Skip production
      break;
    case 'full':
    case 'f':
    default:
      await runEnergySimulation(false); // Full simulation
      break;
  }
}

main().catch(console.error);

export { runEnergySimulation };
