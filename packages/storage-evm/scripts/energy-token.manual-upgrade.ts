import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log(
    'Manually upgrading Energy Token with admin address:',
    adminAddress,
  );
  console.log('Proxy address:', PROXY_ADDRESS);

  // Get the current implementation address before upgrade
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  const EnergyToken = await ethers.getContractFactory('RegularSpaceToken');

  console.log('Contract factory created');
  console.log('Contract bytecode length:', EnergyToken.bytecode.length);

  // Deploy new implementation directly (not via upgrades plugin)
  console.log('Deploying new implementation contract...');
  const newImplementation = await EnergyToken.deploy();
  await newImplementation.waitForDeployment();
  const newImplAddress = await newImplementation.getAddress();

  console.log('✅ New implementation deployed at:', newImplAddress);

  // Verify the new implementation has 6 decimals before upgrading
  console.log('Verifying new implementation has correct decimals...');
  const testContract = await ethers.getContractAt(
    'RegularSpaceToken',
    newImplAddress,
  );
  try {
    // Call decimals as a static call (won't work fully since not initialized, but we can check the bytecode)
    const decimals = await testContract.decimals();
    console.log('✅ New implementation decimals:', decimals.toString());
  } catch (e) {
    console.log(
      'Note: Cannot call decimals on uninitialized implementation (expected)',
    );
  }

  // Get the proxy contract and call upgradeTo
  console.log('Getting proxy contract...');
  const proxy = await ethers.getContractAt('RegularSpaceToken', PROXY_ADDRESS);

  console.log('Calling upgradeTo on proxy...');
  const upgradeTx = await proxy.upgradeToAndCall(newImplAddress, '0x');
  console.log('Upgrade transaction sent:', upgradeTx.hash);

  console.log('Waiting for transaction confirmation...');
  const receipt = await upgradeTx.wait();
  console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

  // Verify the upgrade
  const finalImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Final implementation address:', finalImpl);

  if (currentImpl.toLowerCase() === finalImpl.toLowerCase()) {
    console.log('❌ ERROR: Implementation address did not change!');
  } else {
    console.log('✅ Implementation address changed successfully!');
    console.log(`  Old: ${currentImpl}`);
    console.log(`  New: ${finalImpl}`);
  }

  // Wait a bit for propagation
  console.log('Waiting for propagation...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Verify decimals through the proxy
  console.log('Verifying decimals through proxy...');
  const decimals = await proxy.decimals();
  console.log('Token decimals:', decimals.toString());

  if (decimals.toString() === '6') {
    console.log('✅✅✅ SUCCESS! Decimals correctly set to 6 (USDC standard)');
  } else {
    console.log('❌ Warning: Decimals are not 6, got:', decimals.toString());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
