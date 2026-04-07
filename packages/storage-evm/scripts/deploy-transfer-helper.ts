import { ethers } from 'hardhat';

/**
 * Deploy TransferHelper contract
 *
 * This contract acts as a proxy for all token transfers, allowing you to:
 * 1. Whitelist a single contract address with Coinbase (or other paymasters)
 * 2. Route all token transfers through this contract
 * 3. Optionally manage a whitelist of supported tokens
 *
 * Usage:
 * npx hardhat run scripts/deploy-transfer-helper.ts --network <network-name>
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying TransferHelper contract...');
  console.log('Deployer address:', deployer.address);
  console.log(
    'Deployer balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
  );

  // Deploy TransferHelper
  const TransferHelperFactory = await ethers.getContractFactory(
    'TransferHelper',
  );
  const transferHelper = await TransferHelperFactory.deploy();
  await transferHelper.waitForDeployment();

  const transferHelperAddress = await transferHelper.getAddress();

  console.log('\n✅ TransferHelper deployed successfully!');
  console.log('TransferHelper address:', transferHelperAddress);
  console.log('Owner:', await transferHelper.owner());
  console.log(
    'Whitelist requirement:',
    await transferHelper.requireTokenWhitelist(),
  );

  // Verification command
  console.log('\n📝 To verify the contract on Etherscan, run:');
  console.log(
    `npx hardhat verify --network <network> ${transferHelperAddress}`,
  );

  // Usage instructions
  console.log('\n📖 Usage Instructions:');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  );
  console.log('\n1️⃣  Whitelist this contract with Coinbase Paymaster');
  console.log(`   Contract address: ${transferHelperAddress}`);

  console.log(
    '\n2️⃣  In your frontend, users need to approve this contract before transfers:',
  );
  console.log(
    `   await tokenContract.approve("${transferHelperAddress}", amount);`,
  );

  console.log('\n3️⃣  Execute transfers through the helper contract:');
  console.log(
    `   await transferHelper.transferToken(tokenAddress, recipientAddress, amount);`,
  );

  console.log('\n4️⃣  For batch transfers (save gas):');
  console.log(
    '   await transferHelper.batchTransfer(tokenAddress, [recipient1, recipient2], [amount1, amount2]);',
  );

  console.log(
    '\n5️⃣  Optional: Enable token whitelist (restrict which tokens can be transferred):',
  );
  console.log('   await transferHelper.setWhitelistRequirement(true);');
  console.log('   await transferHelper.setTokenWhitelist(tokenAddress, true);');

  console.log(
    '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
  );

  return {
    transferHelper: transferHelperAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
