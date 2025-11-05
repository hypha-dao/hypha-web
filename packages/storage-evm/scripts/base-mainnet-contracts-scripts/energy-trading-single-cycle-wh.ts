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
        `   Batch ${i + 1}: ${energy} Wh at $${await formatUsdc(
          price,
        )}/Wh (${ownerId})`,
      );
    }
  }
  console.log(`   Total available: ${totalEnergy} Wh`);

  return isZeroSum;
}

async function runSingleTradingCycle() {
  console.log('💱 SINGLE CYCLE ENERGY TRADING TEST (Wh Precision)');
  console.log('='.repeat(60));
  console.log(
    'Testing scenario where one member sells energy to another (using Wh precision).\n',
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
    await displaySystemState(contract, 'Initial State (Before Distribution)');

    // ==================== DISTRIBUTE ====================
    // Using Wh instead of kWh: 500 kWh = 500,000 Wh
    // Price: $0.15/kWh = $0.000150/Wh (0.15 / 1000)
    const totalEnergyWh = 500000; // 500 kWh in Wh
    const pricePerWh = 0.00015; // $0.15/kWh = $0.00015/Wh
    const pricePerKwh = 0.15; // For display purposes
    const nonConsumerIndex = 3; // H4 (12% ownership) doesn't consume
    const overConsumerIndex = 4; // H5 (30% ownership) buys H4's energy

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 Energy Trading Cycle - Wh Precision`);
    console.log(`${'═'.repeat(60)}`);
    console.log(
      `📝 Scenario: H${nonConsumerIndex + 1} doesn't consume, H${
        overConsumerIndex + 1
      } buys their energy`,
    );

    console.log(`\n☀️ Distribution Phase`);
    console.log('-'.repeat(50));
    console.log(
      `Distributing ${totalEnergyWh} Wh (${
        totalEnergyWh / 1000
      } kWh) at $${pricePerWh}/Wh ($${pricePerKwh}/kWh) from Device 1 (H1)`,
    );

    const energySource = [
      {
        sourceId: 1, // Device 1 belongs to H1
        price: ethers.parseUnits(pricePerWh.toString(), 6),
        quantity: totalEnergyWh,
        isImport: false,
      },
    ];

    const distributeTx = await contract.distributeEnergyTokens(energySource, 0);
    await distributeTx.wait();
    console.log('✅ Energy distributed');

    await displaySystemState(contract, 'After Distribution');

    // ==================== CONSUME ====================
    console.log(`\n🏠 Consumption Phase`);
    console.log('-'.repeat(50));

    // Calculate allocated amounts based on ownership percentages
    const consumptionRequests = [];
    let totalRequested = 0;
    let nonConsumerAllocation = 0;

    for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
      const deviceId = i + 1; // Device IDs are 1-indexed
      let allocatedEnergy = Math.floor(
        (totalEnergyWh * OWNERSHIP_PERCENTAGES[i]) / 100,
      );

      // Give any remainder to the last household
      if (i === HOUSEHOLD_ADDRESSES.length - 1) {
        allocatedEnergy = totalEnergyWh - totalRequested;
      }

      if (i === nonConsumerIndex) {
        // This household doesn't consume anything
        console.log(
          `   H${i + 1} NOT consuming (allocated ${allocatedEnergy} Wh (${
            allocatedEnergy / 1000
          } kWh) available for others)`,
        );
        nonConsumerAllocation = allocatedEnergy;
      } else if (i === overConsumerIndex) {
        // This household consumes their share + the non-consumer's share
        const isLastHousehold = i === HOUSEHOLD_ADDRESSES.length - 1;
        const extraEnergy = isLastHousehold ? 0 : nonConsumerAllocation;
        const totalConsumption = allocatedEnergy + extraEnergy;
        consumptionRequests.push({
          deviceId: deviceId,
          quantity: totalConsumption,
        });
        totalRequested += totalConsumption;

        if (isLastHousehold) {
          console.log(
            `   H${i + 1} consuming ${totalConsumption} Wh (${
              totalConsumption / 1000
            } kWh) (includes ${nonConsumerAllocation} Wh from H${
              nonConsumerIndex + 1
            })`,
          );
        } else {
          console.log(
            `   H${i + 1} consuming ${totalConsumption} Wh (${
              totalConsumption / 1000
            } kWh) (${allocatedEnergy} own + ${extraEnergy} from H${
              nonConsumerIndex + 1
            })`,
          );
        }
      } else {
        // Normal consumption
        consumptionRequests.push({
          deviceId: deviceId,
          quantity: allocatedEnergy,
        });
        totalRequested += allocatedEnergy;
        console.log(
          `   H${i + 1} consuming ${allocatedEnergy} Wh (${
            allocatedEnergy / 1000
          } kWh) (${OWNERSHIP_PERCENTAGES[i]}% of ${totalEnergyWh} Wh)`,
        );
      }
    }

    console.log(
      `   Total consumption: ${totalRequested} Wh (${
        totalRequested / 1000
      } kWh)`,
    );

    const consumeTx = await contract.consumeEnergyTokens(consumptionRequests);
    await consumeTx.wait();
    console.log('✅ All consumption complete');

    const afterConsumption = await displaySystemState(
      contract,
      'After Consumption',
    );

    // ==================== ANALYSIS ====================
    console.log(`\n💡 Trading Analysis:`);
    console.log('-'.repeat(50));

    const [nonConsumerBalance] = await contract.getCashCreditBalance(
      HOUSEHOLD_ADDRESSES[nonConsumerIndex],
    );
    const [overConsumerBalance] = await contract.getCashCreditBalance(
      HOUSEHOLD_ADDRESSES[overConsumerIndex],
    );

    const nonConsumerTokens = await contract.getTokenBalance(
      HOUSEHOLD_ADDRESSES[nonConsumerIndex],
    );
    const overConsumerTokens = await contract.getTokenBalance(
      HOUSEHOLD_ADDRESSES[overConsumerIndex],
    );

    console.log(`   H${nonConsumerIndex + 1} (non-consumer):`);
    console.log(`      Balance: +${await formatUsdc(nonConsumerBalance)} USDC`);
    console.log(`      Energy Tokens: ${nonConsumerTokens}`);

    console.log(`   H${overConsumerIndex + 1} (over-consumer):`);
    console.log(`      Balance: ${await formatUsdc(overConsumerBalance)} USDC`);
    console.log(`      Energy Tokens: ${overConsumerTokens}`);

    console.log(`\n📈 Key Metrics:`);
    console.log(
      `   Energy traded: ${nonConsumerAllocation} Wh (${
        nonConsumerAllocation / 1000
      } kWh) (${
        OWNERSHIP_PERCENTAGES[nonConsumerIndex]
      }% of ${totalEnergyWh} Wh)`,
    );
    console.log(
      `   Trade value: $${await formatUsdc(
        BigInt(nonConsumerAllocation) *
          ethers.parseUnits(pricePerWh.toString(), 6),
      )} USDC`,
    );

    if (Number(nonConsumerBalance) > 0) {
      console.log(
        `   ✅ H${
          nonConsumerIndex + 1
        } earned money by not consuming their energy!`,
      );
    } else {
      console.log(
        `   ⚠️  H${nonConsumerIndex + 1} should have positive balance!`,
      );
    }

    if (Number(overConsumerBalance) < 0) {
      console.log(
        `   ✅ H${
          overConsumerIndex + 1
        } paid for the extra energy they consumed!`,
      );
    }

    if (Number(nonConsumerTokens) > 0) {
      console.log(
        `   ✅ H${
          nonConsumerIndex + 1
        } has positive token balance (${nonConsumerTokens} tokens)!`,
      );
    }

    if (Number(overConsumerTokens) === 0 && Number(overConsumerBalance) < 0) {
      console.log(
        `   ✅ H${
          overConsumerIndex + 1
        } has negative cash balance (${await formatUsdc(
          overConsumerBalance,
        )} USDC) - owes money!`,
      );
    }

    // ==================== FINAL SUMMARY ====================
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📋 FINAL SUMMARY');
    console.log(`${'═'.repeat(60)}`);

    if (afterConsumption) {
      console.log('✅ TEST PASSED!');
      console.log('✅ Zero-sum property maintained.');
      console.log('✅ Energy trading works correctly with Wh precision:');
      console.log(
        `   - H${
          nonConsumerIndex + 1
        } has positive balance (+${await formatUsdc(
          nonConsumerBalance,
        )} USDC) and ${nonConsumerTokens} tokens`,
      );
      console.log(
        `   - H${
          overConsumerIndex + 1
        } has negative balance (${await formatUsdc(overConsumerBalance)} USDC)`,
      );
      console.log('   - System maintains zero-sum accounting');
    } else {
      console.log('❌ TEST FAILED!');
      console.log('❌ Zero-sum violation detected.');
    }

    console.log(
      '\n🎉 SINGLE CYCLE ENERGY TRADING TEST (Wh Precision) COMPLETED!',
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error && typeof error === 'object' && 'reason' in error) {
      console.error('Reason:', (error as { reason: string }).reason);
    }
    throw error;
  }
}

runSingleTradingCycle().catch(console.error);
