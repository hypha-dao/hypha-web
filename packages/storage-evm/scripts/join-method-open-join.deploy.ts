import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const OpenJoin = await ethers.getContractFactory('OpenJoin');
  console.log('Deploying OpenJoin...');

  const openJoin = await OpenJoin.deploy();
  await openJoin.waitForDeployment();

  console.log('OpenJoin deployed to:', await openJoin.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 