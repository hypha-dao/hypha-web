import { ethers, upgrades } from 'hardhat';
import { getImplementationAddress } from '@openzeppelin/upgrades-core';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);

  // Deploy the implementation contract
  const EscrowImplementation = await ethers.getContractFactory('EscrowImplementation');
  
  console.log('Deploying Escrow...');
  
  const escrow = await upgrades.deployProxy(
    EscrowImplementation,
    [deployer.address], // Initial owner
    { 
      kind: 'uups',
      initializer: 'initialize'
    }
  );
  
  await escrow.deployed();
  
  const implementationAddress = await getImplementationAddress(
    ethers.provider,
    escrow.address
  );
  
  console.log('Escrow proxy deployed to:', escrow.address);
  console.log('Escrow implementation deployed to:', implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 