import { ethers } from 'hardhat';

/**
 * Deploy ChainlinkOracleTest to Base mainnet.
 *
 * Usage:
 *   npx hardhat run scripts/chainlink-oracle-test.deploy.ts --network base-mainnet
 */

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('Network:', network.name, `(chain ID: ${network.chainId})`);
  console.log('Deployer:', signer.address);
  console.log(
    'Balance:',
    ethers.formatEther(await ethers.provider.getBalance(signer.address)),
    'ETH',
  );
  console.log('----------------------------------------------------');

  const Factory = await ethers.getContractFactory('ChainlinkOracleTest');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('✅ ChainlinkOracleTest deployed to:', address);
  console.log('');
  console.log('Next step — run the test script:');
  console.log(
    `  ORACLE_TEST_ADDRESS=${address} npx hardhat run scripts/chainlink-oracle-test.read.ts --network base-mainnet`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
