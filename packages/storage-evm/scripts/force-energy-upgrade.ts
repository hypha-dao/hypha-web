import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('🔧 Force Deploying New Implementation');
  console.log('Deployer:', await deployer.getAddress());
  console.log('Proxy:', PROXY_ADDRESS);

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('\n📍 Current implementation:', currentImpl);

  // Get the contract factory
  const EnergyDistribution = await ethers.getContractFactory(
    'EnergyDistributionImplementation',
  );

  console.log('\n🚀 Deploying new implementation...');

  // Force deploy a new implementation
  const newImplAddress = await upgrades.deployImplementation(
    EnergyDistribution,
    {
      kind: 'uups',
      unsafeSkipStorageCheck: true,
    },
  );

  console.log('✅ New implementation deployed at:', newImplAddress);

  if (newImplAddress.toString().toLowerCase() === currentImpl.toLowerCase()) {
    console.log(
      '\n⚠️  Same implementation address - bytecode might be identical',
    );
    console.log('This means the compiled code has not changed.');
  } else {
    console.log('\n✅ New implementation address is different!');
    console.log('Now upgrading proxy to point to new implementation...');

    // Upgrade the proxy to use the new implementation
    const upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      EnergyDistribution,
      {
        unsafeSkipStorageCheck: true,
      },
    );

    await upgradedContract.waitForDeployment();

    const finalImpl = await upgrades.erc1967.getImplementationAddress(
      PROXY_ADDRESS,
    );
    console.log('✅ Proxy upgraded! New implementation:', finalImpl);

    // Test the upgrade
    console.log('\n🧪 Testing...');
    const [isZeroSum, balance] = await upgradedContract.verifyZeroSumProperty();
    console.log(
      `Zero-sum: ${isZeroSum ? 'PASS' : 'FAIL'} (balance: ${balance})`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
