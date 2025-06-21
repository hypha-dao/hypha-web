import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('Canceling stuck transaction for address:', deployerAddress);

  // Check current nonces
  const latestNonce = await deployer.getNonce('latest');
  const pendingNonce = await deployer.getNonce('pending');

  console.log('Latest confirmed nonce:', latestNonce);
  console.log('Next pending nonce:', pendingNonce);

  // The stuck nonce (from your error message)
  const stuckNonce = 241;

  console.log(`Attempting to cancel transaction at nonce ${stuckNonce}`);

  // Send 0 ETH to yourself with much higher gas to replace stuck transaction
  const cancelTx = await deployer.sendTransaction({
    to: deployerAddress, // Send to yourself
    value: 0, // 0 ETH
    nonce: stuckNonce, // Use the stuck nonce
    maxFeePerGas: ethers.parseUnits('20', 'gwei'), // Much higher gas
    maxPriorityFeePerGas: ethers.parseUnits('5', 'gwei'),
    gasLimit: 21000, // Standard transfer gas limit
  });

  console.log('Cancellation transaction sent:', cancelTx.hash);
  console.log('Waiting for confirmation...');

  const receipt = await cancelTx.wait();
  console.log('Cancellation transaction confirmed!');
  console.log('Block number:', receipt?.blockNumber);

  // Check nonces after cancellation
  const newLatestNonce = await deployer.getNonce('latest');
  const newPendingNonce = await deployer.getNonce('pending');

  console.log('New latest nonce:', newLatestNonce);
  console.log('New pending nonce:', newPendingNonce);

  if (newLatestNonce === newPendingNonce) {
    console.log(
      '✅ No more pending transactions - you can now run your upgrade!',
    );
  } else {
    console.log('⚠️  Still have pending transactions');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error('Error canceling transaction:', error);
    process.exit(1);
  });
