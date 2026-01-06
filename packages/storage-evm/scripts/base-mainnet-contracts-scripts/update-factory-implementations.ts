import { ethers } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to update token implementation addresses in factories
 *
 * After deploying new token implementations, use this script to update
 * the factories so they deploy tokens with the new implementation.
 *
 * Usage:
 * 1. Deploy new token implementations first
 * 2. Edit the FACTORY_TYPE and NEW_IMPLEMENTATION_ADDRESS below
 * 3. Run: npx hardhat run scripts/base-mainnet-contracts-scripts/update-factory-implementations.ts --network base-mainnet
 */

// ============== CONFIGURATION ==============

// Factory type to update: 'Regular', 'Ownership', or 'Decaying'
const FACTORY_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';

// New implementation address to set in the factory
const NEW_IMPLEMENTATION_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: REPLACE WITH ACTUAL ADDRESS

// Set to true to perform a dry run (check current value without updating)
const DRY_RUN = false;

// ============================================

// Base Mainnet factory addresses
const FACTORY_ADDRESSES = {
  Regular: '0x95A33EC94de2189893884DaD63eAa19f7390144a',
  Ownership: '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6',
  Decaying: '0x299f4D2327933c1f363301dbd2a28379ccD5539b',
};

// Known implementation addresses
const KNOWN_IMPLEMENTATIONS = {
  Regular: {
    old: '0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6',
    beforeTransferHelper: '0x8C105Debd4B222FFb2c438f7034158c6BA29aDB5',
    current: '0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0',
  },
  Ownership: {
    old: '0xB06f27e16648F36C529839413f307a87b80d6ca1',
    current: '0xf9d5AdC2c7D305a5764AD6C6E0a99D3150b9cE39',
  },
  Decaying: {
    old: '0x5BE10FdAce191216236668d9cDb12772f73CB698',
    current: '0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B',
  },
};

// ABIs for each factory type
const REGULAR_FACTORY_ABI = [
  {
    inputs: [],
    name: 'spaceTokenImplementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_implementation', type: 'address' },
    ],
    name: 'setSpaceTokenImplementation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const OWNERSHIP_FACTORY_ABI = [
  {
    inputs: [],
    name: 'ownershipTokenImplementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_implementation', type: 'address' },
    ],
    name: 'setOwnershipTokenImplementation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const DECAYING_FACTORY_ABI = [
  {
    inputs: [],
    name: 'decayingTokenImplementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_implementation', type: 'address' },
    ],
    name: 'setDecayingTokenImplementation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

function getFactoryConfig(factoryType: string) {
  switch (factoryType) {
    case 'Regular':
      return {
        address: FACTORY_ADDRESSES.Regular,
        abi: REGULAR_FACTORY_ABI,
        getterFunction: 'spaceTokenImplementation',
        setterFunction: 'setSpaceTokenImplementation',
      };
    case 'Ownership':
      return {
        address: FACTORY_ADDRESSES.Ownership,
        abi: OWNERSHIP_FACTORY_ABI,
        getterFunction: 'ownershipTokenImplementation',
        setterFunction: 'setOwnershipTokenImplementation',
      };
    case 'Decaying':
      return {
        address: FACTORY_ADDRESSES.Decaying,
        abi: DECAYING_FACTORY_ABI,
        getterFunction: 'decayingTokenImplementation',
        setterFunction: 'setDecayingTokenImplementation',
      };
    default:
      throw new Error(`Unknown factory type: ${factoryType}`);
  }
}

function identifyImplementation(address: string, factoryType: string): string {
  const implementations =
    KNOWN_IMPLEMENTATIONS[factoryType as keyof typeof KNOWN_IMPLEMENTATIONS];
  const addressLower = address.toLowerCase();

  for (const [version, knownAddress] of Object.entries(implementations)) {
    if (knownAddress.toLowerCase() === addressLower) {
      return `${version}`;
    }
  }

  return 'unknown';
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('FACTORY IMPLEMENTATION UPDATE SCRIPT');
  console.log('='.repeat(70));

  // Validate configuration
  if (
    NEW_IMPLEMENTATION_ADDRESS === '0x0000000000000000000000000000000000000000'
  ) {
    console.error(
      '\n❌ Error: Please set NEW_IMPLEMENTATION_ADDRESS to a valid address',
    );
    process.exit(1);
  }

  if (!ethers.isAddress(NEW_IMPLEMENTATION_ADDRESS)) {
    console.error(
      '\n❌ Error: NEW_IMPLEMENTATION_ADDRESS is not a valid address',
    );
    process.exit(1);
  }

  // Get signer
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log(`\nSigner address: ${signerAddress}`);
  console.log(`Factory type: ${FACTORY_TYPE}`);
  console.log(`New implementation: ${NEW_IMPLEMENTATION_ADDRESS}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

  // Get factory config
  const config = getFactoryConfig(FACTORY_TYPE);
  console.log(`\nFactory address: ${config.address}`);

  // Create contract instance
  const factory = new ethers.Contract(config.address, config.abi, signer);

  // Check current implementation
  console.log('\n📖 Reading current implementation...');
  const currentImplementation = await factory[config.getterFunction]();
  console.log(`Current implementation: ${currentImplementation}`);

  const currentVersion = identifyImplementation(
    currentImplementation,
    FACTORY_TYPE,
  );
  console.log(`Identified as: ${currentVersion}`);

  // Check if new implementation is different
  if (
    currentImplementation.toLowerCase() ===
    NEW_IMPLEMENTATION_ADDRESS.toLowerCase()
  ) {
    console.log(
      '\n⚠️  WARNING: New implementation is the same as current implementation!',
    );
    console.log('Nothing to update.');
    return;
  }

  // Identify new implementation
  const newVersion = identifyImplementation(
    NEW_IMPLEMENTATION_ADDRESS,
    FACTORY_TYPE,
  );
  console.log(`\nNew implementation will be: ${NEW_IMPLEMENTATION_ADDRESS}`);
  console.log(`Identified as: ${newVersion}`);

  // Check owner
  console.log('\n🔍 Checking factory owner...');
  const factoryOwner = await factory.owner();
  console.log(`Factory owner: ${factoryOwner}`);

  if (factoryOwner.toLowerCase() !== signerAddress.toLowerCase()) {
    console.error(
      '\n❌ Error: Signer is not the factory owner. Cannot update implementation.',
    );
    console.error(`   Factory owner: ${factoryOwner}`);
    console.error(`   Your address: ${signerAddress}`);
    process.exit(1);
  }

  console.log('✅ Signer is the factory owner');

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN: Would update factory implementation');
    console.log(`   From: ${currentImplementation} (${currentVersion})`);
    console.log(`   To:   ${NEW_IMPLEMENTATION_ADDRESS} (${newVersion})`);
    console.log('\nNo changes made (DRY_RUN=true)');
    return;
  }

  // Confirm before proceeding
  console.log('\n⚠️  WARNING: About to update factory implementation!');
  console.log(`   Factory: ${FACTORY_TYPE} (${config.address})`);
  console.log(`   From: ${currentImplementation} (${currentVersion})`);
  console.log(`   To:   ${NEW_IMPLEMENTATION_ADDRESS} (${newVersion})`);
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Update implementation
  console.log('\n🔄 Updating factory implementation...');
  const tx = await factory[config.setterFunction](NEW_IMPLEMENTATION_ADDRESS);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

  // Verify the update
  console.log('\n🔍 Verifying update...');
  const updatedImplementation = await factory[config.getterFunction]();
  console.log(`Updated implementation: ${updatedImplementation}`);

  if (
    updatedImplementation.toLowerCase() ===
    NEW_IMPLEMENTATION_ADDRESS.toLowerCase()
  ) {
    console.log('✅ Implementation successfully updated!');
  } else {
    console.error('❌ ERROR: Implementation was not updated correctly!');
    console.error(`   Expected: ${NEW_IMPLEMENTATION_ADDRESS}`);
    console.error(`   Got: ${updatedImplementation}`);
    process.exit(1);
  }

  // Show summary
  console.log('\n' + '='.repeat(70));
  console.log('UPDATE SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nFactory: ${FACTORY_TYPE}`);
  console.log(`Factory address: ${config.address}`);
  console.log(
    `\nOld implementation: ${currentImplementation} (${currentVersion})`,
  );
  console.log(`New implementation: ${updatedImplementation} (${newVersion})`);
  console.log(`\nTransaction: ${tx.hash}`);
  console.log(`Block: ${receipt.blockNumber}`);

  console.log('\n✅ Factory implementation update complete!');
  console.log('\nNote: Existing tokens are NOT automatically upgraded.');
  console.log(
    'Only NEW tokens deployed from this factory will use the new implementation.',
  );
  console.log(
    'To upgrade existing tokens, use the upgrade-multiple-tokens.ts script.',
  );
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
