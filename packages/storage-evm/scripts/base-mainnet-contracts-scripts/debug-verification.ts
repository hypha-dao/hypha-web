import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Minimal ABI for testing
const contractAbi = [
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
];

const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
];

async function debugVerification() {
  console.log('🔍 Zero-Sum Verification Debug Tool');
  console.log('=' + '='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);

  console.log(`📍 Contract: ${contractAddress}\n`);

  try {
    // Step 1: Call contract's verification function
    console.log("📊 STEP 1: Contract's verifyZeroSumProperty()");
    console.log('-'.repeat(50));
    const [isZeroSum, balance] = await contract.verifyZeroSumProperty();
    console.log(`Contract verification result: ${isZeroSum ? 'PASS' : 'FAIL'}`);
    console.log(`Contract calculated balance: ${balance.toString()}`);
    console.log(`Contract balance (USDC cents): ${Number(balance) / 100}\n`);

    // Step 2: Get community address and check if it's a member
    console.log('🔍 STEP 2: Community Address Analysis');
    console.log('-'.repeat(50));
    const communityDeviceId = await contract.getCommunityDeviceId();
    const communityAddress = await contract.getDeviceOwner(communityDeviceId);
    console.log(`Community device ID: ${communityDeviceId}`);
    console.log(`Community address: ${communityAddress}`);

    // Check if community address is a registered member
    try {
      const communityMember = await contract.getMember(communityAddress);
      console.log(`✅ Community IS a registered member:`);
      console.log(
        `   - Ownership: ${Number(communityMember.ownershipPercentage) / 100}%`,
      );
      console.log(`   - Active: ${communityMember.isActive}`);
      console.log(`   - Device IDs: [${communityMember.deviceIds.join(', ')}]`);
      console.log(
        `⚠️  POTENTIAL DOUBLE-COUNTING: Community address is both in memberAddresses array AND gets added separately!`,
      );
    } catch (error) {
      console.log(
        `ℹ️  Community is NOT a registered member (device owner only)`,
      );
    }

    // Step 3: Manual calculation
    console.log('\n🧮 STEP 3: Manual Balance Calculation');
    console.log('-'.repeat(50));

    let totalHouseholds = 0;
    console.log('Household balances:');
    for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
      const balance = Number(
        (await contract.getCashCreditBalance(HOUSEHOLD_ADDRESSES[i]))[0],
      );
      totalHouseholds += balance;
      console.log(
        `  Household ${i + 1}: ${balance / 100} USDC cents (${balance} raw)`,
      );
    }
    console.log(
      `Total households: ${
        totalHouseholds / 100
      } USDC cents (${totalHouseholds} raw)`,
    );

    // Community balance
    const communityBalance = Number(
      (await contract.getCashCreditBalance(communityAddress))[0],
    );
    console.log(
      `Community balance: ${
        communityBalance / 100
      } USDC cents (${communityBalance} raw)`,
    );

    // External balances
    const exportBalance = Number(await contract.getExportCashCreditBalance());
    const importBalance = Number(await contract.getImportCashCreditBalance());
    console.log(
      `Export balance: ${
        exportBalance / 100
      } USDC cents (${exportBalance} raw)`,
    );
    console.log(
      `Import balance: ${
        importBalance / 100
      } USDC cents (${importBalance} raw)`,
    );

    // Manual total
    const manualTotal =
      totalHouseholds + communityBalance + exportBalance + importBalance;
    console.log(`\n📊 MANUAL CALCULATION:`);
    console.log(`   Households: ${totalHouseholds}`);
    console.log(`   Community:  ${communityBalance}`);
    console.log(`   Export:     ${exportBalance}`);
    console.log(`   Import:     ${importBalance}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   TOTAL:      ${manualTotal}`);
    console.log(`   USDC cents: ${manualTotal / 100}`);

    // Step 4: Double-counting hypothesis test
    console.log(`\n🔍 STEP 4: Double-Counting Test`);
    console.log('-'.repeat(50));
    const suspectedTotal =
      totalHouseholds + communityBalance + communityBalance; // Community counted twice
    console.log(`If community is double-counted: ${suspectedTotal}`);
    console.log(`Contract result: ${balance.toString()}`);

    if (Number(balance) === suspectedTotal) {
      console.log(`🎯 CONFIRMED: Community balance is being DOUBLE-COUNTED!`);
      console.log(
        `💡 Fix: Update verifyZeroSumProperty() to avoid double-counting community address`,
      );
    }

    // Step 5: Comparison
    console.log(`\n🔍 STEP 5: Final Comparison`);
    console.log('-'.repeat(50));
    console.log(`Contract result: ${balance.toString()}`);
    console.log(`Manual result:   ${manualTotal}`);
    console.log(`Difference:      ${Number(balance) - manualTotal}`);

    if (Number(balance) === manualTotal) {
      console.log(`✅ Contract verification function is working correctly`);
      if (manualTotal === 0) {
        console.log(`✅ System is actually in perfect zero-sum`);
      } else {
        console.log(`❌ System has genuine zero-sum violation`);
      }
    } else {
      console.log(`❌ BUG: Contract verification function is incorrect!`);
      console.log(
        `💡 The contract's verifyZeroSumProperty() has a calculation error`,
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugVerification().catch(console.error);
