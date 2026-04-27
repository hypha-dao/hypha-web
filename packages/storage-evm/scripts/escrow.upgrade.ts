import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x447A317cA5516933264Cdd6aeee0633Fa954B576';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  const currentImpl =
    await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log('Current implementation address:', currentImpl);

  const EscrowImplementation = await ethers.getContractFactory(
    'EscrowImplementation',
  );

  console.log('Deploying new implementation...');
  const newImplDeployTx = await EscrowImplementation.deploy();
  await newImplDeployTx.waitForDeployment();
  const newImplAddress = await newImplDeployTx.getAddress();
  console.log('New implementation deployed at:', newImplAddress);

  // Attach to proxy as UUPS and call upgradeToAndCall
  const proxy = await ethers.getContractAt(
    'EscrowImplementation',
    PROXY_ADDRESS,
  );

  console.log('Calling upgradeToAndCall on proxy...');
  const tx = await proxy.upgradeToAndCall(newImplAddress, '0x');
  console.log('Upgrade tx hash:', tx.hash);
  await tx.wait();

  const verifyImpl =
    await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log('Implementation after upgrade:', verifyImpl);

  if (currentImpl.toLowerCase() === verifyImpl.toLowerCase()) {
    console.log(
      'WARNING: Implementation address did not change! Upgrade may have failed.',
    );
  } else {
    console.log('Implementation address changed successfully!');
  }

  console.log('Escrow proxy address (unchanged):', PROXY_ADDRESS);

  console.log('Upgrade process completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
