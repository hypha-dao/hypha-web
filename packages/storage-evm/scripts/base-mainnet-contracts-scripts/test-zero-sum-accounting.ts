import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Minimal ABI for testing zero-sum accounting
const testAbi = [
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
    inputs: [{ internalType: 'address', name: 'member', type: 'address' }],
    name: 'getCashCreditBalance',
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
];

const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
];

async function getAllBalances(contract: ethers.Contract): Promise<{
  households: number;
  community: number;
  import: number;
  export: number;
  total: number;
}> {
  let householdTotal = 0;

  // Get all household balances
  for (const address of HOUSEHOLD_ADDRESSES) {
    try {
      const balance = Number((await contract.getCashCreditBalance(address))[0]);
      householdTotal += balance;
    } catch (error) {
      console.log(`   Warning: Could not get balance for ${address}`);
    }
  }

  // Get community balance
  let communityBalance = 0;
  try {
    const communityDeviceId = await contract.getCommunityDeviceId();
    const communityAddress = await contract.getDeviceOwner(communityDeviceId);
    if (
      communityAddress &&
      communityAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      communityBalance = Number(
        (await contract.getCashCreditBalance(communityAddress))[0],
      );
      householdTotal += communityBalance;
    }
  } catch (error) {
    console.log(`   Warning: Could not get community balance`);
  }

  // Get import/export balances
  const importBalance = Number(await contract.getImportCashCreditBalance());
  const exportBalance = Number(await contract.getExportCashCreditBalance());

  const total = householdTotal + importBalance + exportBalance;

  return {
    households: householdTotal,
    community: communityBalance,
    import: importBalance,
    export: exportBalance,
    total: total,
  };
}

async function testZeroSumAccounting(): Promise<void> {
  console.log('🧪 Zero-Sum Accounting Test');
  console.log('============================');
  console.log('Testing import consumption accounting fix...\n');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account
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
    console.error('❌ No accounts found');
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  const contractAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, testAbi, wallet);

  console.log(`🔑 Using wallet: ${wallet.address}`);
  console.log(`📍 Contract: ${contractAddress}\n`);

  // Step 1: Get baseline balances
  console.log('📊 STEP 1: Baseline Balances');
  console.log('---------------------------');
  const baseline = await getAllBalances(contract);
  console.log(
    `Households + Community: ${baseline.households / 100} USDC cents`,
  );
  console.log(`Import Balance: ${baseline.import / 100} USDC cents`);
  console.log(`Export Balance: ${baseline.export / 100} USDC cents`);
  console.log(`TOTAL: ${baseline.total / 100} USDC cents`);
  console.log(
    `✅ Baseline zero-sum check: ${baseline.total === 0 ? 'PASS' : 'FAIL'}\n`,
  );

  // Step 2: Import energy
  console.log('📊 STEP 2: Import Energy');
  console.log('------------------------');
  console.log('Importing 10 kWh at 0.5 USDC/kWh = 5.00 USDC');

  const importSources = [
    {
      sourceId: 100,
      price: ethers.parseUnits('0.5', 6), // 0.5 USDC per kWh
      quantity: 10, // 10 kWh
      isImport: true,
    },
  ];

  const distributeTx = await contract.distributeEnergyTokens(importSources, 80);
  await distributeTx.wait();
  console.log(`✅ Import completed: ${distributeTx.hash}\n`);

  const afterImport = await getAllBalances(contract);
  console.log(
    `Households + Community: ${afterImport.households / 100} USDC cents`,
  );
  console.log(`Import Balance: ${afterImport.import / 100} USDC cents`);
  console.log(`Export Balance: ${afterImport.export / 100} USDC cents`);
  console.log(`TOTAL: ${afterImport.total / 100} USDC cents`);

  const importIncrease = afterImport.import - baseline.import;
  console.log(
    `📊 Import balance change: ${
      importIncrease / 100
    } USDC cents (should be 0)`,
  );
  console.log(
    `✅ Post-import zero-sum check: ${
      afterImport.total === 0 ? 'PASS' : 'FAIL'
    }\n`,
  );

  // Step 3: Consume imported energy
  console.log('📊 STEP 3: Consume Imported Energy');
  console.log('----------------------------------');
  console.log('Household 1 consumes 5 kWh of imported energy');

  const consumptionRequests = [
    {
      deviceId: 1, // Household 1's device
      quantity: 5, // 5 kWh
    },
  ];

  const consumeTx = await contract.consumeEnergyTokens(consumptionRequests);
  await consumeTx.wait();
  console.log(`✅ Consumption completed: ${consumeTx.hash}\n`);

  const afterConsumption = await getAllBalances(contract);
  console.log(
    `Households + Community: ${afterConsumption.households / 100} USDC cents`,
  );
  console.log(`Import Balance: ${afterConsumption.import / 100} USDC cents`);
  console.log(`Export Balance: ${afterConsumption.export / 100} USDC cents`);
  console.log(`TOTAL: ${afterConsumption.total / 100} USDC cents`);

  const householdDecrease =
    afterConsumption.households - afterImport.households;

  console.log(
    `📈 Import balance increased by: ${
      (afterConsumption.import - afterImport.import) / 100
    } USDC cents`,
  );
  console.log(
    `📉 Household balance decreased by: ${
      Math.abs(householdDecrease) / 100
    } USDC cents`,
  );
  console.log(
    `📊 Import debt unchanged: ${afterConsumption.import / 100} USDC cents`,
  );
  console.log(
    `✅ Post-consumption zero-sum check: ${
      afterConsumption.total === 0 ? 'PASS' : 'FAIL'
    }\n`,
  );

  // Step 4: Final verification
  console.log('🔍 FINAL VERIFICATION');
  console.log('=====================');

  const expectedImportIncrease = 5 * 50; // 5 kWh × 0.5 USDC (50 cents) = 250 cents
  const actualImportIncrease = afterConsumption.import - afterImport.import;
  const actualHouseholdDecrease = Math.abs(householdDecrease);

  console.log(
    `Expected import balance increase: ${expectedImportIncrease} cents`,
  );
  console.log(`Actual import balance increase: ${actualImportIncrease} cents`);
  console.log(`Actual household payment: ${actualHouseholdDecrease} cents`);
  console.log(
    `Final import balance: ${afterConsumption.import / 100} USDC cents`,
  );

  const importAccountingCorrect =
    actualImportIncrease === expectedImportIncrease;
  const paymentsMatch = actualImportIncrease === actualHouseholdDecrease;
  const zeroSumMaintained = afterConsumption.total === 0;

  console.log(
    `\n✅ Import accounting correct: ${
      importAccountingCorrect ? 'PASS' : 'FAIL'
    }`,
  );
  console.log(`✅ Payments match: ${paymentsMatch ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Zero-sum maintained: ${zeroSumMaintained ? 'PASS' : 'FAIL'}`);

  if (importAccountingCorrect && paymentsMatch && zeroSumMaintained) {
    console.log(`\n🎉 SUCCESS! Zero-sum accounting is working perfectly!`);
    console.log(`💡 Member payments correctly increase import cash balance.`);
    console.log(`💡 Import balance tracks net cash position for settlements.`);
  } else {
    console.log(`\n❌ FAILURE! Zero-sum accounting is still broken.`);
    console.log(`🔍 The import consumption accounting fix may need more work.`);
  }
}

async function main(): Promise<void> {
  try {
    await testZeroSumAccounting();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main().catch(console.error);
