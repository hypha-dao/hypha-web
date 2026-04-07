import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address when deploying
const PROXY_ADDRESS = '0x255c7b5DaC3696199fEF7A8CC6Cc87190bc36eFd';

async function main(): Promise<void> {
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);

  const OwnershipTokenVotingPower = await ethers.getContractFactory(
    'OwnershipTokenVotingPowerImplementation',
  );

  console.log('Upgrading OwnershipTokenVotingPower...');
  const upgradedContract = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    OwnershipTokenVotingPower,
  );

  await upgradedContract.waitForDeployment();
  console.log(
    'OwnershipTokenVotingPower upgraded at address:',
    await upgradedContract.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
