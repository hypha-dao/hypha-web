import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const contractAbi = [
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
    inputs: [{ internalType: 'uint256', name: 'deviceId', type: 'uint256' }],
    name: 'getDeviceOwner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
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
];

const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5
];

const UNKNOWN_ADDRESS = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

async function checkMembers() {
  console.log('🔍 CHECKING REGISTERED MEMBERS');
  console.log('==============================\n');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);

  try {
    // Check all known households
    console.log('Known Households:');
    console.log('-'.repeat(60));
    for (let i = 0; i < HOUSEHOLD_ADDRESSES.length; i++) {
      const address = HOUSEHOLD_ADDRESSES[i];
      try {
        const member = await contract.getMember(address);
        console.log(`\nHousehold ${i + 1}: ${address}`);
        console.log(`  Active: ${member.isActive}`);
        console.log(
          `  Ownership: ${Number(member.ownershipPercentage) / 100}%`,
        );
        console.log(`  Device IDs: ${member.deviceIds.join(', ')}`);
      } catch (error) {
        console.log(`\nHousehold ${i + 1}: ${address}`);
        console.log(`  ❌ Not registered or not active`);
      }
    }

    // Check the unknown address
    console.log('\n\nUnknown Address Found in Energy Pool:');
    console.log('-'.repeat(60));
    try {
      const member = await contract.getMember(UNKNOWN_ADDRESS);
      console.log(`\nAddress: ${UNKNOWN_ADDRESS}`);
      console.log(`  Active: ${member.isActive}`);
      console.log(`  Ownership: ${Number(member.ownershipPercentage) / 100}%`);
      console.log(`  Device IDs: ${member.deviceIds.join(', ')}`);
    } catch (error) {
      console.log(`\nAddress: ${UNKNOWN_ADDRESS}`);
      console.log(`  ❌ Not registered as a member`);
    }

    // Check collective consumption to find all unique owners
    console.log('\n\nAll Owners in Collective Consumption:');
    console.log('-'.repeat(60));
    const collectiveConsumption = await contract.getCollectiveConsumption();
    const uniqueOwners = new Set<string>();

    for (const batch of collectiveConsumption) {
      if (batch.quantity > 0) {
        uniqueOwners.add(batch.owner.toLowerCase());
      }
    }

    console.log(`\nFound ${uniqueOwners.size} unique owners in energy pool:`);
    for (const owner of uniqueOwners) {
      const isImport = owner === '0x0000000000000000000000000000000000000000';
      const householdIndex = HOUSEHOLD_ADDRESSES.findIndex(
        (addr) => addr.toLowerCase() === owner,
      );

      if (isImport) {
        console.log(`  - ${owner} (Import/Grid)`);
      } else if (householdIndex !== -1) {
        console.log(`  - ${owner} (Household ${householdIndex + 1})`);
      } else {
        console.log(`  - ${owner} (UNKNOWN - Not in test list!)`);
        
        // Try to get member info for this unknown address
        try {
          const member = await contract.getMember(owner);
          console.log(`    → Active: ${member.isActive}`);
          console.log(`    → Ownership: ${Number(member.ownershipPercentage) / 100}%`);
          console.log(`    → Devices: ${member.deviceIds.join(', ')}`);
        } catch (err) {
          console.log(`    → Could not fetch member info`);
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

checkMembers().catch(console.error);
