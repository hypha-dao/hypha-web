import { ethers } from 'hardhat';

/**
 * Test TransferHelper on mainnet (or testnet) WITHOUT gas sponsorship
 * This script tests the basic functionality using your own wallet
 *
 * Prerequisites:
 * 1. Deploy TransferHelper (run deploy-transfer-helper.ts)
 * 2. Have a test token deployed (or use existing token)
 * 3. Have some tokens in your wallet to test with
 *
 * Usage:
 * npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base
 */

interface TestConfig {
  transferHelperAddress: string;
  testTokenAddress: string;
  tokenHolderAddress: string;
  recipientAddress: string;
  transferAmount: string; // in token units (e.g., "10" for 10 tokens)
}

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: TestConfig = {
  // Your deployed TransferHelper address
  transferHelperAddress: '0x479002F7602579203ffba3eE84ACC1BC5b0d6785',

  // Token to test with (use your deployed token or any ERC20)
  testTokenAddress: '0x8730C64c3E0A36E2b46C2Cd1fcE05B30Dee56a32',

  // The address that was minted the tokens in the creation script
  tokenHolderAddress: '0xC902cBb668768684E7f21a238dAb4eFD7D4aAF73',

  // Address to send test transfer to (use a wallet you control for testing)
  recipientAddress: '0x82f4a7807852de5667AFee822e6C960b60581498',

  // Amount to transfer (in token units, will be converted based on decimals)
  transferAmount: '100', // Transfer 1 token
};
// ============================================================================

async function main() {
  console.log('🧪 Testing TransferHelper on Mainnet (Negative Test Case)');
  console.log('🧪 Ensuring a user CANNOT transfer tokens they do not own.');
  console.log('═══════════════════════════════════════════════════════\n');

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log('📋 Configuration:');
  console.log('─────────────────────────────────────────────────────');
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Signer (Initiator):', signerAddress);
  console.log(
    'Balance:',
    ethers.formatEther(await ethers.provider.getBalance(signerAddress)),
    'ETH',
  );
  console.log('TransferHelper:', config.transferHelperAddress);
  console.log('Test Token:', config.testTokenAddress);
  console.log('Token Holder:', config.tokenHolderAddress);
  console.log('Recipient:', config.recipientAddress);
  console.log('');

  // Validate configuration
  if (
    config.transferHelperAddress === '0x...' ||
    !ethers.isAddress(config.transferHelperAddress)
  ) {
    console.error('❌ Error: Invalid TransferHelper address');
    console.log(
      'Set TRANSFER_HELPER_ADDRESS environment variable or update config',
    );
    process.exit(1);
  }

  if (
    config.testTokenAddress === '0x...' ||
    !ethers.isAddress(config.testTokenAddress)
  ) {
    console.error('❌ Error: Invalid test token address');
    console.log('Set TEST_TOKEN_ADDRESS environment variable or update config');
    process.exit(1);
  }

  if (
    config.tokenHolderAddress === '0x...' ||
    !ethers.isAddress(config.tokenHolderAddress)
  ) {
    console.error('❌ Error: Invalid token holder address');
    console.log('Set tokenHolderAddress from the token creation script output');
    process.exit(1);
  }

  if (
    config.recipientAddress === '0x...' ||
    !ethers.isAddress(config.recipientAddress)
  ) {
    console.error('❌ Error: Invalid recipient address');
    console.log(
      'Set TEST_RECIPIENT_ADDRESS environment variable or update config',
    );
    process.exit(1);
  }

  // Get contracts
  const TransferHelperFactory = await ethers.getContractFactory(
    'TransferHelper',
  );
  const transferHelper = TransferHelperFactory.attach(
    config.transferHelperAddress,
  );

  const TOKEN_WITH_HELPER_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    // Custom functions for our system
    'function transferHelper() view returns (address)',
  ];

  const token = new ethers.Contract(
    config.testTokenAddress,
    TOKEN_WITH_HELPER_ABI,
    signer,
  );

  // Get token info
  console.log('🪙 Token Information:');
  console.log('─────────────────────────────────────────────────────');

  let tokenName, tokenSymbol, tokenDecimals;
  try {
    tokenName = await token.name();
    tokenSymbol = await token.symbol();
    tokenDecimals = await token.decimals();

    console.log('Name:', tokenName);
    console.log('Symbol:', tokenSymbol);
    console.log('Decimals:', tokenDecimals);
  } catch (error) {
    console.error('❌ Error reading token info:', error);
    console.log('Make sure the token address is correct and implements ERC20');
    process.exit(1);
  }
  console.log('');

  // Check balances
  console.log('💰 Initial Balances:');
  console.log('─────────────────────────────────────────────────────');

  const senderBalance = await token.balanceOf(signerAddress);
  const tokenHolderBalance = await token.balanceOf(config.tokenHolderAddress);

  console.log(
    'Signer (Initiator):',
    ethers.formatUnits(senderBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log(
    'Token Holder:',
    ethers.formatUnits(tokenHolderBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log('');

  // VITAL TEST CONDITION: Signer must NOT have enough tokens for this test to be valid.
  const transferAmountWei = ethers.parseUnits(
    config.transferAmount,
    tokenDecimals,
  );
  if (senderBalance >= transferAmountWei) {
    console.error(
      '❌ TEST SETUP ERROR: The signer has enough tokens to perform the transfer.',
    );
    console.error(
      '   This test is designed to ensure a user CANNOT transfer tokens they do not own.',
    );
    console.error(
      '   Please run this test with a signer account that has a zero (or insufficient) balance of the test token.',
    );
    process.exit(1);
  }

  // VITAL TEST CONDITION: The separate token holder must have enough tokens.
  if (tokenHolderBalance < transferAmountWei) {
    console.error(
      '❌ TEST SETUP ERROR: The token holder does not have enough tokens.',
    );
    console.error(
      '   Please ensure the tokenHolderAddress has been minted tokens and has a sufficient balance.',
    );
    process.exit(1);
  }

  console.log(
    '✅ Test setup is correct. Signer has insufficient funds, but the token holder has funds.',
  );
  console.log('   Now attempting the transfer, which is expected to FAIL.');
  console.log('');

  // Check TransferHelper status
  console.log('🔍 TransferHelper Status:');
  console.log('─────────────────────────────────────────────────────');

  const owner = await transferHelper.owner();
  const whitelistRequired = await transferHelper.requireTokenWhitelist();
  const tokenSupported = await transferHelper.isTokenSupported(
    config.testTokenAddress,
  );

  console.log('Owner:', owner);
  console.log('Whitelist Required:', whitelistRequired);
  console.log('Token Supported:', tokenSupported);
  console.log('');

  // Check if token needs to be whitelisted
  if (whitelistRequired && !tokenSupported) {
    console.log('⚠️  Token needs to be whitelisted!');
    console.log('Run this command:');
    console.log(
      `npx hardhat run scripts/register-token-with-helper.ts --network ${
        (await ethers.provider.getNetwork()).name
      }`,
    );
    console.log('');
    process.exit(1);
  }

  // Step 1: Check if the token is configured to bypass approval
  console.log('📝 Step 1: Checking Token Configuration for Approval Bypass');
  console.log('─────────────────────────────────────────────────────');

  try {
    const configuredHelper = await token.transferHelper();
    if (
      configuredHelper.toLowerCase() ===
      config.transferHelperAddress.toLowerCase()
    ) {
      console.log('✅ Token is configured to trust this TransferHelper.');
      console.log('   Approval step will be bypassed.');
    } else {
      console.error(
        '❌ Error: Token has a different TransferHelper configured.',
      );
      console.error('   Configured Helper:', configuredHelper);
      console.error('   Expected Helper:  ', config.transferHelperAddress);
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ Error: Token does not have `transferHelper()` function.');
    console.error(
      '   This script requires a token configured for this system.',
    );
    process.exit(1);
  }
  console.log('');

  // Step 2: Execute transfer via TransferHelper
  console.log(
    '🚀 Step 2: Executing Transfer via TransferHelper (Expecting Failure)',
  );
  console.log('─────────────────────────────────────────────────────');
  console.log('Attempting to transfer:', config.transferAmount, tokenSymbol);
  console.log('From (Signer):', signerAddress);
  console.log('To:', config.recipientAddress);
  console.log('(Tokens are held by:', config.tokenHolderAddress, ')');
  console.log('');

  try {
    const transferTx = await transferHelper.transferToken(
      config.testTokenAddress,
      config.recipientAddress,
      transferAmountWei,
    );

    console.log('Transfer TX:', transferTx.hash);
    console.log('Waiting for confirmation...');

    const transferReceipt = await transferTx.wait();
    console.log('Block:', transferReceipt?.blockNumber);

    // If we reach here, the transfer SUCCEEDED, which is an error for this test case.
    console.error(
      '❌ TEST FAILED: The transfer succeeded when it should have failed!',
    );
    console.error(
      '   This means TransferHelper might be allowing users to transfer tokens that are not theirs.',
    );
    console.error(
      '   The signer had an insufficient balance, but the transfer was still processed.',
    );
    process.exit(1);
  } catch (error: any) {
    console.log('✅ SUCCESS: The transfer failed as expected.');
    if (error.message) {
      console.log('   Error message:', error.message);
      if (
        error.message.includes('insufficient balance') ||
        error.message.includes('transfer amount exceeds balance')
      ) {
        console.log(
          '   This is the correct error message, confirming the balance check worked.',
        );
      } else {
        console.warn(
          '   Warning: The error message was not the expected balance error, but the transaction failed, which is correct.',
        );
      }
    }
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎉 NEGATIVE TEST COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(
    '✅ TransferHelper correctly prevented a user from transferring tokens they do not own.',
  );
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
