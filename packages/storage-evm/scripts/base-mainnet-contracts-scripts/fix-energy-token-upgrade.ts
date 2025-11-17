import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';

/**
 * Fix the energy token by upgrading to the CORRECT EnergyToken implementation
 * (not RegularSpaceToken which caused storage corruption)
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('🔧 Fixing Energy Token Implementation');
  console.log('='.repeat(60));
  console.log('Admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('\nCurrent implementation:', currentImpl);

  // Deploy the CORRECT EnergyToken implementation (not RegularSpaceToken!)
  console.log('\n📦 Deploying correct EnergyToken implementation...');
  const EnergyToken = await ethers.getContractFactory('EnergyToken');

  const newImplementation = await EnergyToken.deploy(
    'Energy Value Token', // These don't matter for upgrades, proxy keeps its data
    'EVT',
    adminAddress,
  );
  await newImplementation.waitForDeployment();
  const newImplAddress = await newImplementation.getAddress();

  console.log('✅ New EnergyToken implementation deployed at:', newImplAddress);

  // Get the proxy contract
  console.log('\n🔄 Upgrading proxy to correct implementation...');

  // We need to use a minimal UUPS-compatible ABI to call upgradeTo
  const proxyAbi = [
    'function upgradeToAndCall(address newImplementation, bytes memory data) external',
    'function owner() view returns (address)',
  ];

  const proxy = new ethers.Contract(PROXY_ADDRESS, proxyAbi, deployer);

  // Verify we're the owner
  const owner = await proxy.owner();
  if (owner.toLowerCase() !== adminAddress.toLowerCase()) {
    throw new Error(`Not the owner! Owner is ${owner}`);
  }
  console.log('✅ Confirmed you are the owner');

  // Upgrade to the new implementation
  console.log('\n⏳ Sending upgrade transaction...');
  const upgradeTx = await proxy.upgradeToAndCall(newImplAddress, '0x');
  console.log('Transaction hash:', upgradeTx.hash);

  console.log('Waiting for confirmation...');
  const receipt = await upgradeTx.wait();
  console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

  // Verify the upgrade
  const finalImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('\n📊 Verification:');
  console.log('Old implementation:', currentImpl);
  console.log('New implementation:', finalImpl);

  if (currentImpl.toLowerCase() === finalImpl.toLowerCase()) {
    console.log('❌ ERROR: Implementation did not change!');
  } else {
    console.log('✅ Implementation successfully changed!');
  }

  // Test the upgraded contract
  console.log('\n🧪 Testing upgraded contract...');
  const energyTokenAbi = [
    'function decimals() view returns (uint8)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function authorized(address) view returns (bool)',
    'function setAuthorized(address, bool) external',
  ];

  const energyToken = new ethers.Contract(
    PROXY_ADDRESS,
    energyTokenAbi,
    deployer,
  );

  try {
    const decimals = await energyToken.decimals();
    console.log(`✅ Decimals: ${decimals} (should be 6 for EnergyToken)`);

    const name = await energyToken.name();
    console.log(`✅ Name: ${name}`);

    const symbol = await energyToken.symbol();
    console.log(`✅ Symbol: ${symbol}`);
  } catch (error: any) {
    console.log('⚠️  Basic functions test:', error.message.split('\n')[0]);
  }

  console.log('\n🎉 Upgrade complete!');
  console.log('\nNext steps:');
  console.log('1. Run: ts-node authorize-for-reset.ts');
  console.log('2. Run: ts-node emergency-reset.ts execute');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
