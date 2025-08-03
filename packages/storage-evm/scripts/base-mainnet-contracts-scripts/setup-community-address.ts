import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Energy Distribution contract ABI - just the functions we need
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
    inputs: [],
    name: 'getCommunityDeviceId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getExportDeviceId',
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
  // Events
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

async function setupCommunityAddress(): Promise<void> {
  console.log('🏘️ Community Address Setup');
  console.log('Setting up community address for device ID 1001');
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load wallet (same logic as other scripts)
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
    // Step 1: Check current device IDs
    console.log('📋 Step 1: Checking Device ID Configuration...');
    const exportDeviceId = await energyDistribution.getExportDeviceId();
    const communityDeviceId = await energyDistribution.getCommunityDeviceId();

    console.log(`- Export Device ID: ${exportDeviceId}`);
    console.log(`- Community Device ID: ${communityDeviceId}`);

    // Step 2: Check if community device already has an owner
    console.log('\n🔍 Step 2: Checking Community Device Ownership...');
    try {
      const communityOwner = await energyDistribution.getDeviceOwner(
        communityDeviceId,
      );
      if (communityOwner !== '0x0000000000000000000000000000000000000000') {
        console.log(
          `✅ Community device ${communityDeviceId} already has owner: ${communityOwner}`,
        );

        // Check member details
        try {
          const member = await energyDistribution.getMember(communityOwner);
          console.log('📊 Community Member Details:');
          console.log(`   - Address: ${member.memberAddress}`);
          console.log(
            `   - Device IDs: [${member.deviceIds
              .map((id) => Number(id))
              .join(', ')}]`,
          );
          console.log(
            `   - Ownership: ${Number(member.ownershipPercentage) / 100}%`,
          );
          console.log(`   - Active: ${member.isActive}`);
          console.log('\n🎉 Community address is already properly configured!');
          return;
        } catch (error) {
          console.log(
            `⚠️  Community device has owner but member details unavailable`,
          );
        }
      } else {
        console.log(
          `❌ Community device ${communityDeviceId} has no owner (address: ${communityOwner})`,
        );
      }
    } catch (error) {
      console.log(
        `❌ Could not check community device owner: ${error.message}`,
      );
    }

    // Step 3: Add community address as a member
    console.log('\n🏗️ Step 3: Adding Community Address...');

    // Use a different address for community - not the admin wallet since it's already a household member
    // We'll use a well-known test address that's different from the household addresses
    const communityAddress = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    console.log(`📋 Community Setup Details:`);
    console.log(`   - Community Address: ${communityAddress}`);
    console.log(`   - Device ID: ${communityDeviceId}`);
    console.log(`   - Ownership: 0% (community functions only)`);

    // Check current total ownership before adding
    const currentOwnership =
      await energyDistribution.getTotalOwnershipPercentage();
    console.log(
      `   - Current Total Ownership: ${Number(currentOwnership) / 100}%`,
    );

    if (Number(currentOwnership) >= 10000) {
      console.log('\n⚠️  Warning: Total ownership is already 100% or more!');
      console.log(
        '   Adding community address with 0% ownership for functionality only.',
      );
    }

    console.log('\n⏳ Adding community member...');
    const addMemberTx = await energyDistribution.addMember(
      communityAddress,
      [communityDeviceId], // Device ID 1001
      0, // 0% ownership - community functions only
    );

    console.log(`📝 Transaction submitted: ${addMemberTx.hash}`);
    const receipt = await addMemberTx.wait();
    console.log('✅ Transaction confirmed!');

    // Step 4: Verify the setup
    console.log('\n🔍 Step 4: Verifying Community Setup...');

    try {
      const newCommunityOwner = await energyDistribution.getDeviceOwner(
        communityDeviceId,
      );
      console.log(
        `✅ Community device ${communityDeviceId} owner: ${newCommunityOwner}`,
      );

      const member = await energyDistribution.getMember(communityAddress);
      console.log('📊 Verified Community Member:');
      console.log(`   - Address: ${member.memberAddress}`);
      console.log(
        `   - Device IDs: [${member.deviceIds
          .map((id) => Number(id))
          .join(', ')}]`,
      );
      console.log(
        `   - Ownership: ${Number(member.ownershipPercentage) / 100}%`,
      );
      console.log(`   - Active: ${member.isActive}`);

      const finalOwnership =
        await energyDistribution.getTotalOwnershipPercentage();
      console.log(
        `   - Final Total Ownership: ${Number(finalOwnership) / 100}%`,
      );
    } catch (error) {
      console.log(`⚠️  Could not verify setup: ${error.message}`);
    }

    console.log('\n🎉 Community Address Setup Complete!');
    console.log('✅ Energy simulation should now work properly!');
    console.log('🚀 You can now run: npm run energy-simulation');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);

    if (error.message.includes('Member already exists')) {
      console.log(
        '💡 The community address might already be added as a household member.',
      );
      console.log(
        '💡 Try using a different address for the community, or check existing members.',
      );
    } else if (error.message.includes('Total ownership exceeds 100%')) {
      console.log(
        '💡 Cannot add community member - ownership would exceed 100%.',
      );
      console.log(
        '💡 Consider using 0% ownership for community functions only.',
      );
    } else if (error.message.includes('Device ID already assigned')) {
      console.log('💡 Device ID 1001 is already assigned to another member.');
      console.log('💡 Check the community device ID configuration.');
    }
  }
}

async function checkCommunityStatus(): Promise<void> {
  console.log('🔍 Community Address Status Check');
  console.log('='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const energyDistributionAddress =
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    provider,
  );

  try {
    const communityDeviceId = await energyDistribution.getCommunityDeviceId();
    const exportDeviceId = await energyDistribution.getExportDeviceId();

    console.log(`📱 Device IDs:`);
    console.log(`   - Community Device ID: ${communityDeviceId}`);
    console.log(`   - Export Device ID: ${exportDeviceId}`);

    console.log('\n🔍 Checking device ownership...');

    try {
      const communityOwner = await energyDistribution.getDeviceOwner(
        communityDeviceId,
      );
      if (communityOwner === '0x0000000000000000000000000000000000000000') {
        console.log(`❌ Community device ${communityDeviceId} has NO owner`);
        console.log('💡 Run setup to fix this: npm run setup-community');
      } else {
        console.log(
          `✅ Community device ${communityDeviceId} owner: ${communityOwner}`,
        );

        try {
          const member = await energyDistribution.getMember(communityOwner);
          console.log('📊 Community Member Details:');
          console.log(`   - Address: ${member.memberAddress}`);
          console.log(
            `   - Device IDs: [${member.deviceIds
              .map((id) => Number(id))
              .join(', ')}]`,
          );
          console.log(
            `   - Ownership: ${Number(member.ownershipPercentage) / 100}%`,
          );
          console.log(`   - Active: ${member.isActive}`);
        } catch (error) {
          console.log(`⚠️  Could not get member details: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking community device: ${error.message}`);
    }

    try {
      const exportOwner = await energyDistribution.getDeviceOwner(
        exportDeviceId,
      );
      if (exportOwner === '0x0000000000000000000000000000000000000000') {
        console.log(
          `✅ Export device ${exportDeviceId} has no owner (this is correct)`,
        );
      } else {
        console.log(
          `ℹ️  Export device ${exportDeviceId} owner: ${exportOwner}`,
        );
      }
    } catch (error) {
      console.log(`❌ Error checking export device: ${error.message}`);
    }
  } catch (error) {
    console.error('❌ Status check failed:', error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  console.log('🏘️ Community Address Management Tool');
  console.log(`🎯 Command: ${command}\n`);

  switch (command.toLowerCase()) {
    case 'setup':
      await setupCommunityAddress();
      break;
    case 'check':
    case 'status':
      await checkCommunityStatus();
      break;
    default:
      console.log('Available commands:');
      console.log('- setup: Add community address for device ID 1001');
      console.log('- check: Check current community address status');
      console.log('');
      console.log('Usage: npm run setup-community [command]');
      break;
  }
}

main().catch(console.error);

export { setupCommunityAddress, checkCommunityStatus };
