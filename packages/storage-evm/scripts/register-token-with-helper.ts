import { ethers } from 'hardhat';

/**
 * Register a new token with the TransferHelper contract
 *
 * This script can be called automatically when a new token is created
 * to add it to the TransferHelper whitelist (if whitelist is enabled)
 *
 * Usage:
 * npx hardhat run scripts/register-token-with-helper.ts --network <network>
 *
 * Or integrate into your token creation flow:
 *
 * Example integration in your API:
 * ```typescript
 * // After deploying a new token
 * const tokenAddress = await deployNewToken(...);
 *
 * // Register with TransferHelper (optional, only if whitelist is enabled)
 * await registerTokenWithHelper(tokenAddress);
 * ```
 */

interface Config {
  transferHelperAddress: string;
  tokensToRegister: string[];
}

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: Config = {
  // Your deployed TransferHelper address
  transferHelperAddress: '0x...',

  // Add token addresses to register (one or more)
  tokensToRegister: [
    // Add your token addresses here:
    // '0x1234567890123456789012345678901234567890',
    // '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  ],
};
// ============================================================================

async function main() {
  const [signer] = await ethers.getSigners();

  console.log('Registering tokens with TransferHelper...');
  console.log('Signer address:', signer.address);
  console.log('TransferHelper address:', config.transferHelperAddress);

  // Get TransferHelper contract
  const TransferHelperFactory = await ethers.getContractFactory(
    'TransferHelper',
  );
  const transferHelper = TransferHelperFactory.attach(
    config.transferHelperAddress,
  );

  // Verify we're the owner
  const owner = await transferHelper.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error('❌ Error: Signer is not the owner of TransferHelper');
    console.error(`Owner: ${owner}`);
    console.error(`Signer: ${signer.address}`);
    process.exit(1);
  }

  // Check if whitelist is enabled
  const whitelistEnabled = await transferHelper.requireTokenWhitelist();
  console.log('\nWhitelist enabled:', whitelistEnabled);

  if (!whitelistEnabled) {
    console.log('\n⚠️  Warning: Whitelist is not enabled.');
    console.log('All tokens can already be transferred through the helper.');
    console.log('Tokens will still be registered for record keeping.\n');
  }

  // Register tokens
  if (config.tokensToRegister.length === 0) {
    console.log(
      '\n⚠️  No tokens to register. Add token addresses to the config.',
    );
    process.exit(0);
  }

  console.log(`\nRegistering ${config.tokensToRegister.length} token(s)...\n`);

  // Option 1: Register tokens one by one (more gas but better error reporting)
  for (let i = 0; i < config.tokensToRegister.length; i++) {
    const tokenAddress = config.tokensToRegister[i];
    console.log(
      `[${i + 1}/${
        config.tokensToRegister.length
      }] Registering ${tokenAddress}...`,
    );

    try {
      // Check if already whitelisted
      const isSupported = await transferHelper.supportedTokens(tokenAddress);
      if (isSupported) {
        console.log('  ℹ️  Token already whitelisted, skipping...');
        continue;
      }

      // Register token
      const tx = await transferHelper.setTokenWhitelist(tokenAddress, true);
      console.log('  Transaction hash:', tx.hash);

      const receipt = await tx.wait();
      console.log(
        '  ✅ Registered successfully (Block:',
        receipt?.blockNumber,
        ')',
      );

      // Verify registration
      const nowSupported = await transferHelper.isTokenSupported(tokenAddress);
      console.log('  Token now supported:', nowSupported);
    } catch (error: any) {
      console.error('  ❌ Failed to register:', error.message);
    }
    console.log('');
  }

  // Option 2: Batch register (uncomment to use instead)
  /*
  console.log('Batch registering all tokens...');
  try {
    const tx = await transferHelper.batchSetTokenWhitelist(
      config.tokensToRegister,
      true
    );
    console.log('Transaction hash:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ All tokens registered successfully (Block:', receipt?.blockNumber, ')');
    
    // Verify all registrations
    for (const tokenAddress of config.tokensToRegister) {
      const isSupported = await transferHelper.isTokenSupported(tokenAddress);
      console.log(`${tokenAddress}: ${isSupported ? '✅' : '❌'}`);
    }
  } catch (error: any) {
    console.error('❌ Batch registration failed:', error.message);
  }
  */

  console.log('\n✅ Token registration complete!\n');
}

/**
 * Standalone function for programmatic use
 * Can be imported and used in your token creation flow
 */
export async function registerTokenWithHelper(
  tokenAddress: string,
  transferHelperAddress: string,
  signerOrProvider?: any,
): Promise<boolean> {
  try {
    let signer;
    if (signerOrProvider) {
      signer = signerOrProvider;
    } else {
      [signer] = await ethers.getSigners();
    }

    const TransferHelperFactory = await ethers.getContractFactory(
      'TransferHelper',
      signer,
    );
    const transferHelper = TransferHelperFactory.attach(transferHelperAddress);

    // Check if already whitelisted
    const isSupported = await transferHelper.supportedTokens(tokenAddress);
    if (isSupported) {
      console.log(`Token ${tokenAddress} already whitelisted`);
      return true;
    }

    // Register token
    const tx = await transferHelper.setTokenWhitelist(tokenAddress, true);
    await tx.wait();

    console.log(`Token ${tokenAddress} registered with TransferHelper`);
    return true;
  } catch (error) {
    console.error(`Failed to register token ${tokenAddress}:`, error);
    return false;
  }
}

/**
 * Batch register multiple tokens
 */
export async function batchRegisterTokens(
  tokenAddresses: string[],
  transferHelperAddress: string,
  signerOrProvider?: any,
): Promise<boolean> {
  try {
    let signer;
    if (signerOrProvider) {
      signer = signerOrProvider;
    } else {
      [signer] = await ethers.getSigners();
    }

    const TransferHelperFactory = await ethers.getContractFactory(
      'TransferHelper',
      signer,
    );
    const transferHelper = TransferHelperFactory.attach(transferHelperAddress);

    // Filter out already whitelisted tokens
    const tokensToAdd = [];
    for (const tokenAddress of tokenAddresses) {
      const isSupported = await transferHelper.supportedTokens(tokenAddress);
      if (!isSupported) {
        tokensToAdd.push(tokenAddress);
      }
    }

    if (tokensToAdd.length === 0) {
      console.log('All tokens already whitelisted');
      return true;
    }

    // Batch register
    const tx = await transferHelper.batchSetTokenWhitelist(tokensToAdd, true);
    await tx.wait();

    console.log(`${tokensToAdd.length} tokens registered with TransferHelper`);
    return true;
  } catch (error) {
    console.error('Failed to batch register tokens:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
