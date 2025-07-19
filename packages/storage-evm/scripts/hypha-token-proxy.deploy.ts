import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  // Replace these with actual addresses when deploying
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Add actual USDC contract address
  const PAYMENT_TRACKER_ADDRESS = '0x4B61250c8F19BA96C473c65022453E95176b0139'; // Add actual SpacePaymentTracker contract address

  console.log('USDC address:', USDC_ADDRESS);
  console.log('Payment tracker address:', PAYMENT_TRACKER_ADDRESS);

  const HyphaToken = await ethers.getContractFactory('HyphaToken');
  console.log('Deploying HyphaToken...');

  const hyphaToken = await upgrades.deployProxy(
    HyphaToken,
    [USDC_ADDRESS, PAYMENT_TRACKER_ADDRESS],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await hyphaToken.waitForDeployment();
  console.log('HyphaToken deployed to:', await hyphaToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
