import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log('Deploying EnergyToken with account:', deployerAddress);

  const EnergyToken = await ethers.getContractFactory('EnergyToken');

  const tokenName = 'Energy Credit';
  const tokenSymbol = 'NRG';
  const initialOwner = deployerAddress;

  console.log(`Deploying with:`);
  console.log(`  - Name: ${tokenName}`);
  console.log(`  - Symbol: ${tokenSymbol}`);
  console.log(`  - Initial Owner: ${initialOwner}`);

  const energyToken = await EnergyToken.deploy(
    tokenName,
    tokenSymbol,
    initialOwner,
  );

  await energyToken.waitForDeployment();

  const tokenAddress = await energyToken.getAddress();
  console.log('EnergyToken deployed to:', tokenAddress);

  const addressesFilePath = path.join(__dirname, '..', 'addresses.json');
  let addresses = {};
  if (fs.existsSync(addressesFilePath)) {
    addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf-8'));
  }

  addresses['energyToken'] = tokenAddress;

  fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
  console.log(`Token address saved to ${addressesFilePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
