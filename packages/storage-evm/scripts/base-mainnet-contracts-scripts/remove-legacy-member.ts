import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

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

const LEGACY_MEMBER_ADDRESS = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

async function removeLegacyMember() {
  console.log('🗑️  REMOVING LEGACY 0% OWNERSHIP MEMBER');
  console.log('=========================================\n');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  try {
    // Check the member before removal
    console.log('📋 Current State:');
    console.log('-'.repeat(50));
    try {
      const member = await contract.getMember(LEGACY_MEMBER_ADDRESS);
      console.log(`Member Address: ${LEGACY_MEMBER_ADDRESS}`);
      console.log(`  Active: ${member.isActive}`);
      console.log(`  Ownership: ${Number(member.ownershipPercentage) / 100}%`);
      console.log(`  Device IDs: ${member.deviceIds.join(', ')}`);
    } catch (error) {
      console.log(`Member ${LEGACY_MEMBER_ADDRESS} not found or not active.`);
      console.log('Nothing to remove. Exiting.');
      return;
    }

    const totalOwnershipBefore = await contract.getTotalOwnershipPercentage();
    console.log(
      `\nTotal Ownership Before: ${Number(totalOwnershipBefore) / 100}%`,
    );

    // Remove the member
    console.log('\n🔄 Removing Member...');
    console.log('-'.repeat(50));
    const tx = await contract.removeMember(LEGACY_MEMBER_ADDRESS);
    console.log(`Transaction hash: ${tx.hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Verify removal
    console.log('\n📋 After Removal:');
    console.log('-'.repeat(50));
    try {
      const member = await contract.getMember(LEGACY_MEMBER_ADDRESS);
      console.log(`⚠️  Member still exists (Active: ${member.isActive})`);
    } catch (error) {
      console.log(`✅ Member successfully removed (no longer active)`);
    }

    const totalOwnershipAfter = await contract.getTotalOwnershipPercentage();
    console.log(
      `\nTotal Ownership After: ${Number(totalOwnershipAfter) / 100}%`,
    );

    console.log('\n🎉 LEGACY MEMBER REMOVAL COMPLETE!');
    console.log('The contract should now have only the 5 valid households.');
    console.log('You can now run the cyclical-energy-test.ts successfully.');
  } catch (error) {
    console.error('\n❌ Error removing member:', error);
    if (error && typeof error === 'object' && 'reason' in error) {
      console.error('Reason:', (error as { reason: string }).reason);
    }
  }
}

removeLegacyMember().catch(console.error);
