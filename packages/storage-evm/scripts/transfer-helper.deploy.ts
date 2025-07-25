import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const TransferHelper = await ethers.getContractFactory('TransferHelper');
  console.log('Deploying TransferHelper...');

  const transferHelper = await TransferHelper.deploy();
  await transferHelper.waitForDeployment();

  console.log('TransferHelper deployed to:', await transferHelper.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
