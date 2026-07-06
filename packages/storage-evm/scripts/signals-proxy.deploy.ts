import { ethers, upgrades } from 'hardhat';

// Deploys the Signals contract (UUPS proxy) that mirrors signal upvotes
// as on-chain events.
//
// Usage:
//   npx hardhat run scripts/signals-proxy.deploy.ts --network base-mainnet
//
// Optional env:
//   SIGNALS_RELAYER_ADDRESS — relayer wallet to authorize right after deploy
//   (the platform backend account that will call recordUpvote).
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const Signals = await ethers.getContractFactory('SignalsImplementation');
  console.log('Deploying Signals...');

  const signals = await upgrades.deployProxy(Signals, [adminAddress], {
    initializer: 'initialize',
    kind: 'uups',
  });

  await signals.waitForDeployment();
  const proxyAddress = await signals.getAddress();
  console.log('Signals deployed to:', proxyAddress);
  console.log(
    'Implementation deployed to:',
    await upgrades.erc1967.getImplementationAddress(proxyAddress),
  );

  const relayerAddress = process.env.SIGNALS_RELAYER_ADDRESS;
  if (relayerAddress) {
    console.log('Authorizing relayer:', relayerAddress);
    const tx = await signals.setRelayer(relayerAddress, true);
    await tx.wait();
    console.log('Relayer authorized.');
  } else {
    console.log(
      'No SIGNALS_RELAYER_ADDRESS set — authorize the backend relayer later with setRelayer(address, true).',
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
