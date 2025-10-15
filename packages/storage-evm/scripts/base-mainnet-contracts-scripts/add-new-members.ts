import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

interface NewMember {
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

// New members to add with ownership percentages (in basis points: 1% = 100)
const NEW_MEMBERS: NewMember[] = [
  {
    address: '0x5Cc613e48B7Cf91319aBF4B8593cB48E4f260d15',
    deviceIds: [1],
    ownershipPercentage: 2000, // 20%
    name: 'Member 1',
  },
  {
    address: '0x4B8cC92107f6Dc275671E33f8d6F595E87C834D8',
    deviceIds: [2],
    ownershipPercentage: 1600, // 16%
    name: 'Member 2',
  },
  {
    address: '0x54C90c498d1594684a9332736EA6b0448e2AA135',
    deviceIds: [3],
    ownershipPercentage: 2200, // 22%
    name: 'Member 3',
  },
  {
    address: '0x83F00d9F2B94DA4872797dd94F6a355F2E346c7D',
    deviceIds: [4],
    ownershipPercentage: 1200, // 12%
    name: 'Member 4',
  },
  {
    address: '0xA7B5E8AaCefa58ED64A4e137deDe0F77650C8880',
    deviceIds: [5],
    ownershipPercentage: 3000, // 30%
    name: 'Member 5',
  },
];

// Helper function to create valid checksummed address
function createValidAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch (error) {
    const lowerAddress = address.toLowerCase();
    return ethers.getAddress(lowerAddress);
  }
}

async function addNewMembers(): Promise<void> {
  console.log('🔧 Adding New Members to Energy Distribution Contract...');
  console.log('👥 Adding 5 new members with specified ownership percentages');
  console.log('⚡ Energy Units: 1 contract unit = 1 kWh');
  console.log('='.repeat(70));

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

  // Calculate total ownership to be added
  const totalNewOwnership = NEW_MEMBERS.reduce(
    (sum, member) => sum + member.ownershipPercentage,
    0,
  );
  console.log(`📊 Total Ownership to Add: ${totalNewOwnership / 100}%`);
  if (totalNewOwnership !== 10000) {
    console.log(
      `⚠️  WARNING: Total ownership is ${totalNewOwnership / 100}%, not 100%`,
    );
  } else {
    console.log('✅ Total ownership equals 100% (perfect!)');
  }
  console.log('');

  // Check current total ownership before adding
  try {
    const currentOwnership =
      await energyDistribution.getTotalOwnershipPercentage();
    console.log(
      `📊 Current total ownership: ${Number(currentOwnership) / 100}%`,
    );
    if (Number(currentOwnership) > 0) {
      console.log(
        `⚠️  WARNING: Contract already has members! Adding these will result in ${
          (Number(currentOwnership) + totalNewOwnership) / 100
        }% total ownership`,
      );
    }
    console.log('');
  } catch (error) {
    console.log('⚠️  Could not read current ownership');
  }

  let successCount = 0;
  let totalOwnershipAdded = 0;
  const addedMembers: string[] = [];

  // Add each new member
  for (let i = 0; i < NEW_MEMBERS.length; i++) {
    const member = NEW_MEMBERS[i];
    console.log(`👤 Adding ${member.name}:`);
    console.log(`- Address: ${member.address}`);
    console.log(`- Device ID: ${member.deviceIds[0]}`);
    console.log(
      `- Ownership: ${member.ownershipPercentage / 100}% (${
        member.ownershipPercentage
      } basis points)`,
    );

    try {
      // Ensure address has valid checksum
      const checksummedAddress = createValidAddress(member.address);
      console.log(`- Checksummed Address: ${checksummedAddress}`);

      // Check if member already exists
      try {
        const existingMember = await energyDistribution.getMember(
          checksummedAddress,
        );
        if (existingMember.isActive) {
          console.log(`⚠️  ${member.name} already exists and is active`);
          console.log('   Skipping...');
          console.log('');
          continue;
        }
      } catch (error) {
        // Member doesn't exist, which is what we expect
      }

      // Add the member
      console.log('   📤 Submitting transaction...');
      const memberTx = await energyDistribution.addMember(
        checksummedAddress,
        member.deviceIds,
        member.ownershipPercentage,
      );
      console.log(`   ⏳ Transaction hash: ${memberTx.hash}`);
      console.log('   ⏳ Waiting for confirmation...');
      const receipt = await memberTx.wait();
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

      successCount++;
      totalOwnershipAdded += member.ownershipPercentage;
      addedMembers.push(`${member.name} (${checksummedAddress})`);
    } catch (error) {
      console.error(`   ❌ Failed to add ${member.name}:`);
      if (error instanceof Error) {
        console.error(`   Error: ${error.message}`);
      }
    }
    console.log('');
  }

  // Final summary
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(
    `✅ Successfully added: ${successCount} out of ${NEW_MEMBERS.length} members`,
  );
  console.log(`📈 Total ownership added: ${totalOwnershipAdded / 100}%`);

  if (addedMembers.length > 0) {
    console.log('\n👥 Added Members:');
    addedMembers.forEach((member, idx) => {
      console.log(`   ${idx + 1}. ${member}`);
    });
  }

  if (successCount < NEW_MEMBERS.length) {
    console.log(
      `\n⚠️  ${NEW_MEMBERS.length - successCount} member(s) were not added`,
    );
  }

  // Check final total ownership
  try {
    const finalOwnership =
      await energyDistribution.getTotalOwnershipPercentage();
    console.log(`\n📊 Final total ownership: ${Number(finalOwnership) / 100}%`);

    if (Number(finalOwnership) === 10000) {
      console.log('🎉 Perfect! Total ownership equals 100%');
    } else if (Number(finalOwnership) < 10000) {
      console.log(
        `ℹ️  Total ownership is ${Number(finalOwnership) / 100}% (${
          (10000 - Number(finalOwnership)) / 100
        }% remaining)`,
      );
    } else {
      console.log(
        `⚠️  WARNING: Total ownership exceeds 100% (${
          Number(finalOwnership) / 100
        }%)`,
      );
    }
  } catch (error) {
    console.log('⚠️  Could not verify final ownership');
  }

  console.log('\n🎉 Member addition process completed!');
  console.log('⚡ Energy system: 1 contract unit = 1 kWh');
}

async function checkNewMembers(): Promise<void> {
  console.log('🔍 Checking Status of New Members...');
  console.log('='.repeat(70));

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

  // Check each new member
  let activeCount = 0;
  let missingCount = 0;

  for (let i = 0; i < NEW_MEMBERS.length; i++) {
    const member = NEW_MEMBERS[i];
    console.log(`👤 ${member.name} Status:`);
    console.log(`- Address: ${member.address}`);
    console.log(`- Expected Device ID: ${member.deviceIds[0]}`);
    console.log(`- Expected Ownership: ${member.ownershipPercentage / 100}%`);

    try {
      const checksummedAddress = createValidAddress(member.address);
      const memberData = await energyDistribution.getMember(checksummedAddress);

      if (memberData.isActive) {
        console.log(`✅ Status: ACTIVE`);
        console.log(`- Device IDs: [${memberData.deviceIds.join(', ')}]`);
        console.log(
          `- Ownership: ${Number(memberData.ownershipPercentage) / 100}%`,
        );
        activeCount++;
      } else {
        console.log(`❌ Status: NOT ACTIVE`);
        missingCount++;
      }
    } catch (error) {
      console.log(`❌ Status: NOT FOUND (needs to be added)`);
      missingCount++;
    }
    console.log('');
  }

  console.log('📊 Summary:');
  console.log(`- Active members: ${activeCount}`);
  console.log(`- Missing members: ${missingCount}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'add';

  console.log('👥 New Members Management Tool');
  console.log(`🎯 Command: ${command}`);
  console.log('');

  switch (command.toLowerCase()) {
    case 'add':
      await addNewMembers();
      break;
    case 'check':
    case 'status':
      await checkNewMembers();
      break;
    case 'both':
      await checkNewMembers();
      console.log('\n' + '='.repeat(70) + '\n');
      await addNewMembers();
      break;
    default:
      console.log('Available commands:');
      console.log('- add: Add the new members to the contract');
      console.log('- check: Check status of new members');
      console.log('- both: Check status and then add new members');
      console.log('');
      console.log('Usage: npx ts-node add-new-members.ts [command]');
      break;
  }
}

// Run the script
main().catch(console.error);

// Export functions for potential reuse
export { addNewMembers, checkNewMembers, NEW_MEMBERS };
