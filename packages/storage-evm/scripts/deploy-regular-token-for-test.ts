import { ethers } from 'hardhat';

/**
 * Deploys a RegularSpaceToken and mints tokens to a test address.
 * This script is a simplified version for creating a test token for TransferHelper,
 * without involving governance (DAOSpaceFactory, DAOProposals).
 *
 * Usage:
 * npx hardhat run scripts/deploy-regular-token-for-test.ts --network <your-network>
 */

// Address that will receive the minted tokens for testing TransferHelper
const MINT_TO_ADDRESS = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';

async function main() {
  console.log('🚀 Starting deployment of RegularSpaceToken for testing...');

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('Network:', network.name, `(chain ID: ${network.chainId})`);
  console.log('Deploying contracts with the account:', signer.address);
  console.log(
    'Signer balance:',
    ethers.formatEther(await ethers.provider.getBalance(signer.address)),
    'ETH',
  );
  console.log('----------------------------------------------------');

  const tokenName = 'Test Utility Token for TransferHelper';
  const tokenSymbol = 'TUTTH';
  const spaceId = 1; // Dummy spaceId for direct deployment
  const maxSupply = 0; // 0 means unlimited supply
  const transferable = true; // Transferable to any address
  const initialOwner = signer.address; // Deployer will be the owner

  console.log('Token Parameters:');
  console.log(`  Name: ${tokenName}`);
  console.log(`  Symbol: ${tokenSymbol}`);
  console.log(`  Space ID: ${spaceId}`);
  console.log(`  Max Supply: ${maxSupply === 0 ? 'Unlimited' : maxSupply}`);
  console.log(`  Transferable: ${transferable}`);
  console.log(`  Initial Owner: ${initialOwner}`);
  console.log('----------------------------------------------------');

  console.log('Deploying RegularSpaceToken...');
  const RegularSpaceTokenFactory = await ethers.getContractFactory(
    'RegularSpaceToken',
  );
  const regularSpaceToken = await RegularSpaceTokenFactory.deploy(
    spaceId,
    tokenName,
    tokenSymbol,
    maxSupply,
    transferable,
    initialOwner,
  );

  await regularSpaceToken.waitForDeployment();
  const tokenAddress = await regularSpaceToken.getAddress();
  console.log('✅ RegularSpaceToken deployed to:', tokenAddress);
  console.log('----------------------------------------------------');

  const mintAmount = ethers.parseUnits('10000', 18); // Mint 10,000 tokens

  console.log(
    `Minting ${ethers.formatUnits(
      mintAmount,
      18,
    )} ${tokenSymbol} to ${MINT_TO_ADDRESS}...`,
  );

  try {
    const mintTx = await regularSpaceToken.mint(MINT_TO_ADDRESS, mintAmount);
    console.log('Minting transaction sent:', mintTx.hash);
    await mintTx.wait();
    console.log('✅ Minting transaction confirmed!');
  } catch (error) {
    console.error('❌ Minting failed:', error);
    process.exit(1);
  }
  console.log('----------------------------------------------------');

  console.log('Verifying balance...');
  const balance = await regularSpaceToken.balanceOf(MINT_TO_ADDRESS);
  console.log(
    `✅ Balance of ${MINT_TO_ADDRESS} is now ${ethers.formatUnits(
      balance,
      18,
    )} ${tokenSymbol}`,
  );
  console.log('----------------------------------------------------');

  console.log('🎉 All done!');
  console.log(
    'You can now use this token address in your TransferHelper test scripts:',
  );
  console.log(`export TEST_TOKEN_ADDRESS=${tokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
