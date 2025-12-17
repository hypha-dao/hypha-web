import { ethers, upgrades, network } from 'hardhat';

/**
 * This script tests the upgrade on a local fork of Base mainnet.
 * It will:
 * 1. Fork Base mainnet at the current block
 * 2. Impersonate the owner account
 * 3. Perform the upgrade
 * 4. Verify all existing state is preserved
 * 5. Test the new whitelist functions
 *
 * Run with: npx hardhat run scripts/test-rndao-upgrade-on-fork.ts --network hardhat
 */

const PROXY_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';
const OWNER_ADDRESS = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';

// Test addresses for whitelist
const TEST_ADDRESSES = [
  '0xeE20d9344762B17f4925066922948Ba29606f013',
  '0x6930098be6C1d3142FfBCc5921fe29Ea77d2e828',
  '0xBbB55389831D3b01338Ed91b637FC21a606F3357',
];

interface ContractState {
  name: string;
  symbol: string;
  totalSupply: bigint;
  decimals: number;
  executor: string;
  spaceId: bigint;
  maxSupply: bigint;
  transferable: boolean;
  decayPercentage: bigint;
  decayRate: bigint;
  archived: boolean;
  useTransferWhitelist: boolean;
  useReceiveWhitelist: boolean;
}

async function getContractState(contract: any): Promise<ContractState> {
  return {
    name: await contract.name(),
    symbol: await contract.symbol(),
    totalSupply: await contract.totalSupply(),
    decimals: await contract.decimals(),
    executor: await contract.executor(),
    spaceId: await contract.spaceId(),
    maxSupply: await contract.maxSupply(),
    transferable: await contract.transferable(),
    decayPercentage: await contract.decayPercentage(),
    decayRate: await contract.decayRate(),
    archived: await contract.archived(),
    useTransferWhitelist: await contract.useTransferWhitelist(),
    useReceiveWhitelist: await contract.useReceiveWhitelist(),
  };
}

function compareStates(before: ContractState, after: ContractState): boolean {
  const keys = Object.keys(before) as (keyof ContractState)[];
  let allMatch = true;

  for (const key of keys) {
    const beforeVal = before[key];
    const afterVal = after[key];
    const match = beforeVal === afterVal || beforeVal.toString() === afterVal.toString();
    
    if (!match) {
      console.log(`  ❌ ${key}: ${beforeVal} -> ${afterVal}`);
      allMatch = false;
    } else {
      console.log(`  ✅ ${key}: ${afterVal}`);
    }
  }

  return allMatch;
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('TESTING UPGRADE ON FORKED MAINNET');
  console.log('='.repeat(60));
  console.log('');

  // Check if we're on a fork
  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log('Chain ID:', chainId.toString());
  
  // Fork Base mainnet if not already forked
  if (chainId !== 31337n) {
    console.log('❌ This script must be run on a local fork. Use --network hardhat');
    console.log('');
    console.log('First, make sure your hardhat.config.ts has forking configured:');
    console.log('');
    console.log('  hardhat: {');
    console.log('    forking: {');
    console.log('      url: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",');
    console.log('    },');
    console.log('  },');
    console.log('');
    process.exit(1);
  }

  // Reset the fork to get fresh state
  console.log('Resetting fork to current mainnet state...');
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.RPC_URL || 'https://mainnet.base.org',
        },
      },
    ],
  });

  console.log('');
  console.log('=== Step 1: Reading current contract state ===');
  console.log('');

  // Get current contract with DecayingSpaceToken ABI
  const DecayingSpaceToken = await ethers.getContractFactory('DecayingSpaceToken');
  const currentContract = DecayingSpaceToken.attach(PROXY_ADDRESS);

  const stateBefore = await getContractState(currentContract);
  console.log('Current state:');
  for (const [key, value] of Object.entries(stateBefore)) {
    console.log(`  ${key}: ${value}`);
  }

  // Get current implementation address
  const implBefore = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log('');
  console.log('Current implementation:', implBefore);

  console.log('');
  console.log('=== Step 2: Impersonating owner and performing upgrade ===');
  console.log('');

  // Impersonate the owner
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [OWNER_ADDRESS],
  });

  // Fund the impersonated account for gas
  await network.provider.send('hardhat_setBalance', [
    OWNER_ADDRESS,
    '0x56BC75E2D63100000', // 100 ETH
  ]);

  const ownerSigner = await ethers.getSigner(OWNER_ADDRESS);
  console.log('Impersonating owner:', OWNER_ADDRESS);

  // Get the new contract factory
  const RNDAODecayingSpaceToken = await ethers.getContractFactory(
    'RNDAODecayingSpaceToken',
    ownerSigner,
  );

  console.log('Upgrading contract...');

  try {
    // First, try to force import the proxy
    try {
      await upgrades.forceImport(PROXY_ADDRESS, DecayingSpaceToken, {
        kind: 'uups',
      });
      console.log('Proxy imported successfully');
    } catch (e) {
      console.log('Proxy already imported or import not needed');
    }

    // Perform the upgrade
    const upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      RNDAODecayingSpaceToken,
      {
        unsafeSkipStorageCheck: true,
        unsafeAllow: ['missing-initializer'],
      },
    );

    await upgradedContract.waitForDeployment();
    console.log('✅ Upgrade completed!');

    // Get new implementation address
    const implAfter = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log('');
    console.log('Previous implementation:', implBefore);
    console.log('New implementation:', implAfter);
    console.log('Implementation changed:', implBefore !== implAfter ? '✅ Yes' : '⚠️  No');

    console.log('');
    console.log('=== Step 3: Verifying state preservation ===');
    console.log('');

    const stateAfter = await getContractState(upgradedContract);
    const statePreserved = compareStates(stateBefore, stateAfter);

    if (statePreserved) {
      console.log('');
      console.log('✅ All state preserved correctly!');
    } else {
      console.log('');
      console.log('❌ Some state was corrupted!');
      process.exit(1);
    }

    console.log('');
    console.log('=== Step 4: Testing new whitelist functions (as owner) ===');
    console.log('');

    // Test batchSetTransferWhitelist
    console.log('Testing batchSetTransferWhitelist...');
    const allowedArray = TEST_ADDRESSES.map(() => true);
    
    const txTransfer = await upgradedContract.batchSetTransferWhitelist(
      TEST_ADDRESSES,
      allowedArray,
    );
    await txTransfer.wait();
    console.log('✅ batchSetTransferWhitelist executed successfully');

    // Verify transfer whitelist
    for (const addr of TEST_ADDRESSES) {
      const canTransfer = await upgradedContract.canTransfer(addr);
      console.log(`  ${addr} canTransfer: ${canTransfer}`);
      if (!canTransfer) {
        console.log('❌ Transfer whitelist not set correctly!');
        process.exit(1);
      }
    }

    // Test batchSetReceiveWhitelist
    console.log('');
    console.log('Testing batchSetReceiveWhitelist...');
    
    const txReceive = await upgradedContract.batchSetReceiveWhitelist(
      TEST_ADDRESSES,
      allowedArray,
    );
    await txReceive.wait();
    console.log('✅ batchSetReceiveWhitelist executed successfully');

    // Verify receive whitelist
    for (const addr of TEST_ADDRESSES) {
      const canReceive = await upgradedContract.canReceive(addr);
      console.log(`  ${addr} canReceive: ${canReceive}`);
      if (!canReceive) {
        console.log('❌ Receive whitelist not set correctly!');
        process.exit(1);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED! UPGRADE IS SAFE TO PERFORM');
    console.log('='.repeat(60));
    console.log('');
    console.log('You can now run the actual upgrade on mainnet:');
    console.log('npx nx run storage-evm:script ./scripts/rndao-decaying-space-token.upgrade.ts --network base-mainnet');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ UPGRADE FAILED!');
    console.error(error);
    process.exit(1);
  }

  // Stop impersonating
  await network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [OWNER_ADDRESS],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });

