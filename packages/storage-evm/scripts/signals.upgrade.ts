import { ethers, upgrades } from 'hardhat';

// Signals proxy on Base mainnet (see contracts/addresses.txt).
const PROXY_ADDRESS = '0x967A4bD9a10Bba875d0098fbd3206ca4259A509f';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  const Signals = await ethers.getContractFactory('SignalsImplementation');

  let upgradedContract;

  try {
    console.log('Upgrading Signals...');
    upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, Signals, {
      unsafeSkipStorageCheck: true,
    });
    await upgradedContract.waitForDeployment();
  } catch (error) {
    if (error instanceof Error && error.message.includes('is not registered')) {
      console.log(
        'Proxy not registered with upgrades plugin. Importing and retrying...',
      );
      await upgrades.forceImport(PROXY_ADDRESS, Signals);
      upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, Signals, {
        unsafeSkipStorageCheck: true,
      });
      await upgradedContract.waitForDeployment();
    } else {
      throw error;
    }
  }

  const newImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('New implementation address:', newImpl);

  if (currentImpl.toLowerCase() === newImpl.toLowerCase()) {
    console.log(
      'WARNING: Implementation address did not change. Upgrade may have failed.',
    );
  } else {
    console.log('Implementation address changed successfully.');
  }

  console.log('Signals proxy address (unchanged):', PROXY_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
