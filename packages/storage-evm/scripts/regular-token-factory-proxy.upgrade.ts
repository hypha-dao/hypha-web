import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x9425c91c19066f6CAC6C25bF934F8861914Ccf2e'; // RegularTokenFactory mainnet proxy

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  const RegularTokenFactory = await ethers.getContractFactory(
    'RegularTokenFactory',
  );

  console.log('Upgrading RegularTokenFactory...');
  const upgradedContract = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    RegularTokenFactory,
  );

  await upgradedContract.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('New implementation address:', newImpl);

  if (currentImpl.toLowerCase() === newImpl.toLowerCase()) {
    console.log(
      '⚠️ WARNING: Implementation address did not change! Upgrade may have failed.',
    );
  } else {
    console.log('✅ Implementation address changed successfully!');
  }

  console.log(
    'RegularTokenFactory proxy address (unchanged):',
    await upgradedContract.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
