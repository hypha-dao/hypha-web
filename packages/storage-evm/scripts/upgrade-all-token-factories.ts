import { ethers, upgrades } from 'hardhat';

/**
 * Comprehensive script to upgrade all token factories and their implementations.
 *
 * This script performs the following steps:
 * 1. Validates storage layout compatibility (no storage collisions)
 * 2. Deploys new token implementations (Regular, Decaying, Ownership)
 * 3. Upgrades the token factories
 * 4. Updates factories to use new token implementations
 *
 * Run with: npx hardhat run scripts/upgrade-all-token-factories.ts --network base
 */

// ============== CONFIGURATION ==============
const CONFIG = {
  // Factory proxy addresses
  factories: {
    regular: '0x95A33EC94de2189893884DaD63eAa19f7390144a',
    decaying: '0x299f4D2327933c1f363301dbd2a28379ccD5539b',
    ownership: '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6',
  },
  // Set to true to skip storage validation (use with caution!)
  unsafeSkipStorageCheck: false,
  // Set to true for dry run (validate only, no actual upgrades)
  dryRun: false,
};

// ============== TYPES ==============
interface UpgradeResult {
  name: string;
  proxyAddress: string;
  oldImplementation: string;
  newImplementation: string;
  success: boolean;
  error?: string;
}

interface DeployResult {
  name: string;
  implementationAddress: string;
  success: boolean;
  error?: string;
}

// ============== HELPER FUNCTIONS ==============

async function validateStorageLayout(
  contractName: string,
  proxyAddress: string,
): Promise<boolean> {
  console.log(`  Validating storage layout for ${contractName}...`);

  try {
    const ContractFactory = await ethers.getContractFactory(contractName);

    // This will throw if there are storage layout incompatibilities
    await upgrades.validateUpgrade(proxyAddress, ContractFactory, {
      kind: 'uups',
    });

    console.log(`  ✅ Storage layout is compatible for ${contractName}`);
    return true;
  } catch (error: any) {
    if (error.message.includes('is not registered')) {
      // Proxy not registered, need to import first
      console.log(`  ⚠️  Proxy not registered, will import during upgrade`);
      return true;
    }

    console.error(`  ❌ Storage validation failed for ${contractName}:`);
    console.error(`     ${error.message}`);
    return false;
  }
}

async function deployImplementation(contractName: string): Promise<DeployResult> {
  console.log(`\n  Deploying ${contractName} implementation...`);

  try {
    const ContractFactory = await ethers.getContractFactory(contractName);

    const implementationAddress = (await upgrades.deployImplementation(
      ContractFactory,
      { kind: 'uups' },
    )) as string;

    console.log(`  ✅ ${contractName} implementation deployed at: ${implementationAddress}`);

    return {
      name: contractName,
      implementationAddress,
      success: true,
    };
  } catch (error: any) {
    console.error(`  ❌ Failed to deploy ${contractName}: ${error.message}`);
    return {
      name: contractName,
      implementationAddress: '',
      success: false,
      error: error.message,
    };
  }
}

async function upgradeFactory(
  factoryName: string,
  proxyAddress: string,
): Promise<UpgradeResult> {
  console.log(`\n  Upgrading ${factoryName}...`);
  console.log(`  Proxy address: ${proxyAddress}`);

  const result: UpgradeResult = {
    name: factoryName,
    proxyAddress,
    oldImplementation: '',
    newImplementation: '',
    success: false,
  };

  try {
    // Get current implementation
    result.oldImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`  Current implementation: ${result.oldImplementation}`);

    const ContractFactory = await ethers.getContractFactory(factoryName);

    let upgradedContract;

    try {
      upgradedContract = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
        unsafeSkipStorageCheck: CONFIG.unsafeSkipStorageCheck,
      });
    } catch (error: any) {
      if (error.message.includes('is not registered')) {
        console.log(`  ⚠️  Proxy not registered. Importing...`);
        await upgrades.forceImport(proxyAddress, ContractFactory);
        console.log(`  ✅ Proxy imported. Retrying upgrade...`);

        upgradedContract = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
          unsafeSkipStorageCheck: CONFIG.unsafeSkipStorageCheck,
        });
      } else {
        throw error;
      }
    }

    await upgradedContract.waitForDeployment();

    result.newImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`  New implementation: ${result.newImplementation}`);

    if (result.oldImplementation.toLowerCase() === result.newImplementation.toLowerCase()) {
      console.log(`  ⚠️  Implementation address unchanged (may already be up to date)`);
    } else {
      console.log(`  ✅ ${factoryName} upgraded successfully!`);
    }

    result.success = true;
  } catch (error: any) {
    console.error(`  ❌ Failed to upgrade ${factoryName}: ${error.message}`);
    result.error = error.message;
  }

  return result;
}

async function setTokenImplementation(
  factoryAddress: string,
  factoryName: string,
  tokenImplementationAddress: string,
  setterFunctionName: string,
  getterFunctionName: string,
): Promise<boolean> {
  console.log(`\n  Setting ${factoryName} token implementation...`);
  console.log(`  New implementation: ${tokenImplementationAddress}`);

  try {
    const abi = [
      {
        inputs: [{ internalType: 'address', name: '_implementation', type: 'address' }],
        name: setterFunctionName,
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: getterFunctionName,
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    const [deployer] = await ethers.getSigners();
    const factory = new ethers.Contract(factoryAddress, abi, deployer);

    // Check current implementation
    const currentImpl = await factory[getterFunctionName]();
    console.log(`  Current token implementation: ${currentImpl}`);

    if (currentImpl.toLowerCase() === tokenImplementationAddress.toLowerCase()) {
      console.log(`  ✅ Already using the correct implementation`);
      return true;
    }

    // Set new implementation
    const tx = await factory[setterFunctionName](tokenImplementationAddress);
    console.log(`  Transaction sent: ${tx.hash}`);
    await tx.wait();

    // Verify
    const newImpl = await factory[getterFunctionName]();
    if (newImpl.toLowerCase() === tokenImplementationAddress.toLowerCase()) {
      console.log(`  ✅ Token implementation updated successfully!`);
      return true;
    } else {
      console.error(`  ❌ Implementation not updated correctly`);
      return false;
    }
  } catch (error: any) {
    console.error(`  ❌ Failed to set implementation: ${error.message}`);
    return false;
  }
}

// ============== MAIN ==============

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE TOKEN FACTORY UPGRADE SCRIPT               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Dry Run: ${CONFIG.dryRun}`);
  console.log(`Skip Storage Check: ${CONFIG.unsafeSkipStorageCheck}`);
  console.log('');

  // ============== STEP 1: VALIDATE STORAGE LAYOUTS ==============
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STEP 1: Validating Storage Layouts');
  console.log('═══════════════════════════════════════════════════════════════');

  const validations = {
    regularFactory: await validateStorageLayout(
      'RegularTokenFactory',
      CONFIG.factories.regular,
    ),
    decayingFactory: await validateStorageLayout(
      'DecayingTokenFactory',
      CONFIG.factories.decaying,
    ),
    ownershipFactory: await validateStorageLayout(
      'OwnershipTokenFactory',
      CONFIG.factories.ownership,
    ),
  };

  const allValid = Object.values(validations).every((v) => v);
  if (!allValid && !CONFIG.unsafeSkipStorageCheck) {
    console.error('\n❌ Storage validation failed. Aborting upgrade.');
    console.error('   Set CONFIG.unsafeSkipStorageCheck = true to force upgrade (dangerous!)');
    process.exit(1);
  }

  if (CONFIG.dryRun) {
    console.log('\n🔍 DRY RUN: Storage validation complete. Exiting without changes.');
    return;
  }

  // ============== STEP 2: DEPLOY TOKEN IMPLEMENTATIONS ==============
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('STEP 2: Deploying New Token Implementations');
  console.log('═══════════════════════════════════════════════════════════════');

  const tokenDeployments = {
    regular: await deployImplementation('RegularSpaceToken'),
    decaying: await deployImplementation('DecayingSpaceToken'),
    ownership: await deployImplementation('OwnershipSpaceToken'),
  };

  const allTokensDeployed = Object.values(tokenDeployments).every((d) => d.success);
  if (!allTokensDeployed) {
    console.error('\n❌ Some token implementations failed to deploy. Aborting.');
    process.exit(1);
  }

  // ============== STEP 3: UPGRADE FACTORIES ==============
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('STEP 3: Upgrading Token Factories');
  console.log('═══════════════════════════════════════════════════════════════');

  const factoryUpgrades = {
    regular: await upgradeFactory('RegularTokenFactory', CONFIG.factories.regular),
    decaying: await upgradeFactory('DecayingTokenFactory', CONFIG.factories.decaying),
    ownership: await upgradeFactory('OwnershipTokenFactory', CONFIG.factories.ownership),
  };

  // ============== STEP 4: SET TOKEN IMPLEMENTATIONS IN FACTORIES ==============
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('STEP 4: Setting Token Implementations in Factories');
  console.log('═══════════════════════════════════════════════════════════════');

  const implUpdates = {
    regular: await setTokenImplementation(
      CONFIG.factories.regular,
      'RegularTokenFactory',
      tokenDeployments.regular.implementationAddress,
      'setSpaceTokenImplementation',
      'spaceTokenImplementation',
    ),
    decaying: await setTokenImplementation(
      CONFIG.factories.decaying,
      'DecayingTokenFactory',
      tokenDeployments.decaying.implementationAddress,
      'setDecayingTokenImplementation',
      'decayingTokenImplementation',
    ),
    ownership: await setTokenImplementation(
      CONFIG.factories.ownership,
      'OwnershipTokenFactory',
      tokenDeployments.ownership.implementationAddress,
      'setOwnershipTokenImplementation',
      'ownershipTokenImplementation',
    ),
  };

  // ============== SUMMARY ==============
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('\n📦 Token Implementations Deployed:');
  console.log(`   RegularSpaceToken:    ${tokenDeployments.regular.implementationAddress}`);
  console.log(`   DecayingSpaceToken:   ${tokenDeployments.decaying.implementationAddress}`);
  console.log(`   OwnershipSpaceToken:  ${tokenDeployments.ownership.implementationAddress}`);

  console.log('\n🏭 Factory Upgrades:');
  Object.entries(factoryUpgrades).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.name}`);
    if (result.success && result.oldImplementation !== result.newImplementation) {
      console.log(`      Old: ${result.oldImplementation}`);
      console.log(`      New: ${result.newImplementation}`);
    }
  });

  console.log('\n🔗 Implementation Updates:');
  Object.entries(implUpdates).forEach(([name, success]) => {
    const status = success ? '✅' : '❌';
    console.log(`   ${status} ${name}TokenFactory`);
  });

  const allSuccess =
    Object.values(factoryUpgrades).every((r) => r.success) &&
    Object.values(implUpdates).every((r) => r);

  console.log('\n' + (allSuccess ? '✅ All upgrades completed successfully!' : '⚠️  Some upgrades failed. Check logs above.'));
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });

