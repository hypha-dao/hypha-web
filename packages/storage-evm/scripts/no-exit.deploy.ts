import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const NoExit = await ethers.getContractFactory('NoExit');
  console.log('Deploying NoExit...');

  const noExit = await NoExit.deploy();
  await noExit.waitForDeployment();

  console.log('NoExit deployed to:', await noExit.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 