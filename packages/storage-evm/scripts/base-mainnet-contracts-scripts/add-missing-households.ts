import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

interface MissingHousehold {
  address: string;
  deviceIds: number[];
  ownershipPercentage: number;
  name: string;
}

// Energy Distribution contract ABI - key functions only
const energyDistributionAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'memberAddress', type: 'address' },
      { internalType: 'uint256[]', name: 'deviceIds', type: 'uint256[]' },
      { internalType: 'uint256', name: 'ownershipPercentage', type: 'uint256' },
    ],
    name: 'addMember',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [],
    name: 'getTotalOwnershipPercentage',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'memberAddress',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256[]',
        name: 'deviceIds',
        type: 'uint256[]',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'ownershipPercentage',
        type: 'uint256',
      },
    ],
    name: 'MemberAdded',
    type: 'event',
  },
];

// Missing households that failed due to checksum errors - using valid checksummed addresses
const MISSING_HOUSEHOLDS: MissingHousehold[] = [
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2 - Valid checksummed address
    deviceIds: [2],
    ownershipPercentage: 2500, // 25%
    name: 'Household 2',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3 - Valid checksummed address
    deviceIds: [3],
    ownershipPercentage: 2000, // 20%
    name: 'Household 3',
  },
];

// Helper function to create valid checksummed address from potentially invalid one
function createValidAddress(invalidAddress: string): string {
  try {
    // First try direct checksum
    return ethers.getAddress(invalidAddress);
  } catch (error) {
    // If that fails, convert to lowercase and then apply proper checksum
    const lowerAddress = invalidAddress.toLowerCase();
    return ethers.getAddress(lowerAddress);
  }
}

async function addMissingHouseholds(): Promise<void> {
  console.log(
    '🔧 Adding Missing Households to Energy Distribution Contract...',
  );
  console.log(
    '🏠 Adding 2 households that failed due to address checksum errors',
  );
  console.log('⚡ Energy Units: 1 contract unit = 1 kWh');
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
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

  // Energy Distribution contract address
  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  );

  console.log(`📍 Energy Distribution Contract: ${energyDistribution.target}`);
  console.log('');

  // Check current total ownership before adding
  try {
    const currentOwnership =
      await energyDistribution.getTotalOwnershipPercentage();
    console.log(
      `📊 Current total ownership: ${Number(currentOwnership) / 100}%`,
    );
    console.log('');
  } catch (error) {
    console.log('⚠️  Could not read current ownership');
  }

  let successCount = 0;
  let totalOwnershipAdded = 0;

  // Add each missing household
  for (let i = 0; i < MISSING_HOUSEHOLDS.length; i++) {
    const household = MISSING_HOUSEHOLDS[i];
    console.log(`🏠 Adding ${household.name}:`);
    console.log(`- Address: ${household.address}`);
    console.log(`- Device ID: ${household.deviceIds[0]}`);
    console.log(
      `- Ownership: ${household.ownershipPercentage / 100}% (${
        household.ownershipPercentage
      } basis points)`,
    );

    try {
      // Fix address checksum using helper function
      const checksummedAddress = createValidAddress(household.address);
      console.log(`- Checksummed Address: ${checksummedAddress}`);

      // Check if member already exists
      try {
        const existingMember = await energyDistribution.getMember(
          checksummedAddress,
        );
        if (existingMember.isActive) {
          console.log(`⚠️  ${household.name} already exists and is active`);
          console.log('');
          continue;
        }
      } catch (error) {
        // Member doesn't exist, which is what we expect
      }

      // Add the household
      const memberTx = await energyDistribution.addMember(
        checksummedAddress,
        household.deviceIds,
        household.ownershipPercentage,
      );
      console.log(`⏳ Add household tx: ${memberTx.hash}`);
      await memberTx.wait();
      console.log(`✅ ${household.name} added successfully`);

      successCount++;
      totalOwnershipAdded += household.ownershipPercentage;
    } catch (error) {
      console.error(`❌ Failed to add ${household.name}:`, error);
    }
    console.log('');
  }

  // Final summary
  console.log(`📊 Summary:`);
  console.log(
    `- Households successfully added: ${successCount} out of ${MISSING_HOUSEHOLDS.length}`,
  );
  console.log(`- Total ownership added: ${totalOwnershipAdded / 100}%`);

  if (successCount === MISSING_HOUSEHOLDS.length) {
    console.log(`- Expected total ownership: 100% (10000 basis points)`);
    console.log('✅ All missing households added successfully!');
  } else {
    console.log(
      `⚠️  ${
        MISSING_HOUSEHOLDS.length - successCount
      } households still missing`,
    );
  }

  // Check final total ownership
  try {
    const finalOwnership =
      await energyDistribution.getTotalOwnershipPercentage();
    console.log(`- Final total ownership: ${Number(finalOwnership) / 100}%`);

    if (Number(finalOwnership) === 10000) {
      console.log('🎉 Perfect! Total ownership now equals 100%');
    } else {
      console.log(
        `⚠️  Total ownership is ${Number(finalOwnership) / 100}%, not 100%`,
      );
    }
  } catch (error) {
    console.log('⚠️  Could not verify final ownership');
  }

  console.log('\n🎉 Missing households addition completed!');
  console.log('⚡ Energy system: 1 contract unit = 1 kWh');
}

async function checkMissingHouseholds(): Promise<void> {
  console.log('🔍 Checking Status of Missing Households...');
  console.log('='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    provider,
  );

  console.log(`📍 Energy Distribution Contract: ${energyDistribution.target}`);
  console.log('');

  // Check current total ownership
  try {
    const currentOwnership =
      await energyDistribution.getTotalOwnershipPercentage();
    console.log(
      `📊 Current total ownership: ${Number(currentOwnership) / 100}%`,
    );
    console.log('');
  } catch (error) {
    console.log('❌ Could not read current ownership');
    return;
  }

  // Check each missing household
  for (let i = 0; i < MISSING_HOUSEHOLDS.length; i++) {
    const household = MISSING_HOUSEHOLDS[i];
    console.log(`🏠 ${household.name} Status:`);
    console.log(`- Address: ${household.address}`);
    console.log(`- Expected Device ID: ${household.deviceIds[0]}`);
    console.log(
      `- Expected Ownership: ${household.ownershipPercentage / 100}%`,
    );

    try {
      const checksummedAddress = createValidAddress(household.address);
      const member = await energyDistribution.getMember(checksummedAddress);

      if (member.isActive) {
        console.log(`✅ Status: ACTIVE`);
        console.log(`- Device IDs: [${member.deviceIds.join(', ')}]`);
        console.log(
          `- Ownership: ${Number(member.ownershipPercentage) / 100}%`,
        );
      } else {
        console.log(`❌ Status: NOT ACTIVE`);
      }
    } catch (error) {
      console.log(`❌ Status: NOT FOUND (needs to be added)`);
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'add';

  console.log('🏠 Missing Households Management Tool');
  console.log(`🎯 Command: ${command}`);
  console.log('');

  switch (command.toLowerCase()) {
    case 'add':
      await addMissingHouseholds();
      break;
    case 'check':
    case 'status':
      await checkMissingHouseholds();
      break;
    case 'both':
      await checkMissingHouseholds();
      console.log('\n' + '='.repeat(70));
      await addMissingHouseholds();
      break;
    default:
      console.log('Available commands:');
      console.log('- add: Add the missing households to the contract');
      console.log('- check: Check status of missing households');
      console.log('- both: Check status and then add missing households');
      console.log('');
      console.log('Usage: npx ts-node add-missing-households.ts [command]');
      break;
  }
}

// Run the script
main().catch(console.error);

// Export functions for potential reuse
export { addMissingHouseholds, checkMissingHouseholds, MISSING_HOUSEHOLDS };
