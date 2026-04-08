import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

const contractAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'memberAddress', type: 'address' },
    ],
    name: 'removeMember',
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
];

// All known member addresses to remove
const MEMBER_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Legacy member (if exists)
];

async function removeAllMembers() {
  console.log('🗑️  REMOVING ALL MEMBERS FROM CONTRACT');
  console.log('=========================================\n');

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
    // Check the total ownership before removal
    const totalOwnershipBefore = await contract.getTotalOwnershipPercentage();
    console.log('📋 Initial State:');
    console.log('-'.repeat(50));
    console.log(
      `Total Ownership Before: ${Number(totalOwnershipBefore) / 100}%\n`,
    );

    // Track statistics
    let removedCount = 0;
    let notFoundCount = 0;
    const removedMembers: string[] = [];

    // Check which members exist
    console.log('🔍 Checking which members exist:');
    console.log('-'.repeat(50));
    for (const address of MEMBER_ADDRESSES) {
      try {
        const member = await contract.getMember(address);
        if (member.isActive) {
          console.log(`✓ ${address}`);
          console.log(
            `  Ownership: ${Number(member.ownershipPercentage) / 100}%`,
          );
          console.log(`  Device IDs: ${member.deviceIds.join(', ')}`);
        } else {
          console.log(`○ ${address} (not active)`);
          notFoundCount++;
        }
      } catch (error) {
        console.log(`○ ${address} (not found)`);
        notFoundCount++;
      }
    }

    console.log('\n🔄 Removing Members...');
    console.log('-'.repeat(50));

    // Remove each member
    for (const address of MEMBER_ADDRESSES) {
      try {
        // Check if member exists before attempting removal
        const member = await contract.getMember(address);
        if (!member.isActive) {
          console.log(`⏭️  Skipping ${address} (not active)`);
          continue;
        }

        console.log(`\n🗑️  Removing: ${address}`);
        const tx = await contract.removeMember(address);
        console.log(`   Transaction hash: ${tx.hash}`);

        console.log('   ⏳ Waiting for confirmation...');
        const receipt = await tx.wait();
        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

        removedCount++;
        removedMembers.push(address);
      } catch (error) {
        console.log(`   ⏭️  Skipped ${address} (not found or already removed)`);
        notFoundCount++;
      }
    }

    // Verify removal
    console.log('\n📋 Verification After Removal:');
    console.log('-'.repeat(50));

    let stillActiveCount = 0;
    for (const address of MEMBER_ADDRESSES) {
      try {
        const member = await contract.getMember(address);
        if (member.isActive) {
          console.log(`⚠️  ${address} still active!`);
          stillActiveCount++;
        }
      } catch (error) {
        // Expected - member should not exist
      }
    }

    const totalOwnershipAfter = await contract.getTotalOwnershipPercentage();
    console.log(
      `\nTotal Ownership After: ${Number(totalOwnershipAfter) / 100}%`,
    );

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total addresses checked: ${MEMBER_ADDRESSES.length}`);
    console.log(`Successfully removed: ${removedCount}`);
    console.log(`Not found/already removed: ${notFoundCount}`);
    console.log(`Still active: ${stillActiveCount}`);
    console.log(
      `\nOwnership change: ${Number(totalOwnershipBefore) / 100}% → ${
        Number(totalOwnershipAfter) / 100
      }%`,
    );

    if (stillActiveCount === 0 && Number(totalOwnershipAfter) === 0) {
      console.log('\n🎉 SUCCESS! All members removed and ownership is 0%');
    } else if (stillActiveCount > 0) {
      console.log('\n⚠️  WARNING: Some members are still active');
    } else {
      console.log('\n✅ Member removal completed');
    }

    if (removedMembers.length > 0) {
      console.log('\n📝 Removed Members:');
      removedMembers.forEach((addr, idx) => {
        console.log(`  ${idx + 1}. ${addr}`);
      });
    }
  } catch (error) {
    console.error('\n❌ Error removing members:', error);
    if (error && typeof error === 'object' && 'reason' in error) {
      console.error('Reason:', (error as { reason: string }).reason);
    }
  }
}

removeAllMembers().catch(console.error);
