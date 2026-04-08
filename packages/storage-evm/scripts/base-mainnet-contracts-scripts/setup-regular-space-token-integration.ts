import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

const ENERGY_DISTRIBUTION_ADDRESS =
  '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
const REGULAR_SPACE_TOKEN_PROXY_ADDRESS =
  '0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a';
const OLD_TOKEN_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';

/**
 * Complete automated script to:
 * 1. Deploy new implementation of RegularSpaceToken with authorization
 * 2. Upgrade proxy to new implementation
 * 3. Authorize EnergyDistribution to use RegularSpaceToken
 * 4. Update EnergyDistribution to use the token
 * 5. Run emergency reset
 * 6. Verify setup
 */

const energyDistributionAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenAddress', type: 'address' },
    ],
    name: 'setEnergyToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEnergyTokenAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isAddressWhitelisted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'emergencyReset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifyZeroSumProperty',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'int256', name: '', type: 'int256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const regularSpaceTokenAbi = [
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'bool', name: '_authorized', type: 'bool' },
    ],
    name: 'setAuthorized',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'newImplementation', type: 'address' },
    ],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'newImplementation', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function loadWallet(
  provider: ethers.JsonRpcProvider,
): Promise<ethers.Wallet> {
  let accountData: AccountData[] = [];

  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      const parsedData = JSON.parse(data);
      accountData = parsedData.filter(
        (account: AccountData) =>
          account.privateKey && account.privateKey.length === 64,
      );
    }
  } catch (error) {
    // Fallback to env
  }

  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      const wallet = new ethers.Wallet(cleanPrivateKey);
      accountData = [{ privateKey: cleanPrivateKey, address: wallet.address }];
    }
  }

  if (accountData.length === 0) {
    throw new Error('No wallet found');
  }

  return new ethers.Wallet(accountData[0].privateKey, provider);
}

async function deployNewImplementation(wallet: ethers.Wallet): Promise<string> {
  console.log('\n📦 Step 1: Deploying New Implementation');
  console.log('='.repeat(60));

  console.log('Reading compiled contract artifacts...');

  const path = require('path');
  const artifactPath = path.resolve(
    __dirname,
    '../../artifacts/contracts/energytokenupdatable.sol/RegularSpaceToken.json',
  );

  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    console.error('❌ Could not find compiled contract artifact!');
    console.error('Please compile the contract first by running:');
    console.error('  cd packages/storage-evm');
    console.error('  npx hardhat compile');
    throw new Error('Contract not compiled');
  }

  console.log('✅ Contract artifact loaded');
  console.log(`Bytecode size: ${artifact.bytecode.length / 2} bytes`);

  // Deploy the implementation
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet,
  );

  console.log('Deploying implementation contract...');
  console.log('This may take a minute...');

  const implementation = await factory.deploy();
  console.log(
    `Transaction sent: ${implementation.deploymentTransaction()?.hash}`,
  );

  await implementation.waitForDeployment();

  const implementationAddress = await implementation.getAddress();
  console.log(`✅ Implementation deployed at: ${implementationAddress}`);

  return implementationAddress;
}

async function upgradeProxy(
  proxyAddress: string,
  newImplementationAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n🔄 Step 2: Upgrading Proxy to New Implementation');
  console.log('='.repeat(60));

  const proxy = new ethers.Contract(proxyAddress, regularSpaceTokenAbi, wallet);

  // Check current owner
  const owner = await proxy.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `You are not the proxy owner. Owner is: ${owner}, Your address: ${wallet.address}`,
    );
  }
  console.log('✅ You are the proxy owner');

  // Get current implementation (if method exists)
  try {
    const currentImpl = await proxy.implementation();
    console.log(`Current implementation: ${currentImpl}`);
  } catch (error) {
    console.log('Could not read current implementation address');
  }

  console.log(`New implementation: ${newImplementationAddress}`);

  // Try upgradeToAndCall with manual gas limit (gas estimation often fails)
  console.log('Attempting upgrade with upgradeToAndCall...');
  console.log('(Gas estimation may fail, using manual gas limit)');

  let tx;
  try {
    // Try to estimate gas first
    try {
      const gasEstimate = await proxy.upgradeToAndCall.estimateGas(
        newImplementationAddress,
        '0x',
      );
      console.log(`Gas estimate: ${gasEstimate.toString()}`);

      // Send with 50% extra gas buffer
      tx = await proxy.upgradeToAndCall(newImplementationAddress, '0x', {
        gasLimit: (gasEstimate * 3n) / 2n,
      });
    } catch (estimateError) {
      console.log(
        '⚠️  Gas estimation failed, using fixed gas limit of 200,000',
      );
      // If estimation fails, use a reasonable fixed gas limit
      tx = await proxy.upgradeToAndCall(newImplementationAddress, '0x', {
        gasLimit: 200000n,
      });
    }

    console.log(`✅ Transaction sent: ${tx.hash}`);
  } catch (error: any) {
    console.log('⚠️  upgradeToAndCall failed, trying upgradeTo...');
    console.log(`Error: ${error.message.substring(0, 100)}...`);

    // Fallback to upgradeTo
    try {
      // Try with manual gas limit
      try {
        const gasEstimate = await proxy.upgradeTo.estimateGas(
          newImplementationAddress,
        );
        tx = await proxy.upgradeTo(newImplementationAddress, {
          gasLimit: (gasEstimate * 3n) / 2n,
        });
      } catch (estimateError) {
        console.log('⚠️  Gas estimation failed, using fixed gas limit');
        tx = await proxy.upgradeTo(newImplementationAddress, {
          gasLimit: 200000n,
        });
      }

      console.log(`✅ Transaction sent: ${tx.hash}`);
    } catch (upgradeToError: any) {
      console.error('\n❌ Both upgrade methods failed!');
      console.error(`upgradeToAndCall error: ${error.message}`);
      console.error(`upgradeTo error: ${upgradeToError.message}`);
      throw new Error('Unable to upgrade proxy with either method');
    }
  }

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log('✅ Proxy upgraded successfully');

  // Verify upgrade by checking storage slot
  const provider = wallet.provider;
  if (provider) {
    const IMPLEMENTATION_SLOT =
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const implSlotValue = await provider.getStorage(
      proxyAddress,
      IMPLEMENTATION_SLOT,
    );
    const implementationAddress = ethers.getAddress(
      '0x' + implSlotValue.slice(-40),
    );

    console.log(
      `Current implementation (from storage): ${implementationAddress}`,
    );

    if (
      implementationAddress.toLowerCase() !==
      newImplementationAddress.toLowerCase()
    ) {
      throw new Error(
        'Implementation verification failed - storage not updated',
      );
    }
    console.log('✅ Implementation verification passed');
  }
}

async function checkTokenInfo(
  tokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n📋 Step 3: Checking Token Information');
  console.log('='.repeat(60));

  const token = new ethers.Contract(tokenAddress, regularSpaceTokenAbi, wallet);

  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const owner = await token.owner();
    const totalSupply = await token.totalSupply();

    console.log(`Token Name: ${name}`);
    console.log(`Token Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals} (should be 6)`);
    console.log(`Owner: ${owner}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
    console.log(`Your Address: ${wallet.address}`);

    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log('⚠️  Warning: You are not the owner of this token!');
      console.log(`   Owner is: ${owner}`);
      throw new Error('You must be the token owner to proceed');
    }

    console.log('✅ You are the token owner');

    if (decimals !== 6) {
      console.log('⚠️  Warning: Decimals are not 6!');
    }
  } catch (error: any) {
    console.error('Failed to get token info:', error.message);
    throw error;
  }
}

async function authorizeEnergyDistribution(
  tokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n🔐 Step 4: Authorizing EnergyDistribution');
  console.log('='.repeat(60));

  const token = new ethers.Contract(tokenAddress, regularSpaceTokenAbi, wallet);

  // Check current authorization
  try {
    const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);
    console.log(
      `Current authorization: ${
        isAuthorized ? 'Authorized ✅' : 'Not Authorized ❌'
      }`,
    );

    if (isAuthorized) {
      console.log('✅ Already authorized, skipping');
      return;
    }
  } catch (error) {
    console.log('Could not check authorization, proceeding to authorize...');
  }

  // Authorize
  console.log('Sending setAuthorized transaction...');
  const tx = await token.setAuthorized(ENERGY_DISTRIBUTION_ADDRESS, true);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log('✅ Authorization successful');

  // Verify
  const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);
  if (!isAuthorized) {
    throw new Error('Authorization verification failed');
  }
  console.log('✅ Verification passed');
}

async function updateEnergyDistribution(
  newTokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n🔄 Step 5: Updating EnergyDistribution');
  console.log('='.repeat(60));

  const energyDistribution = new ethers.Contract(
    ENERGY_DISTRIBUTION_ADDRESS,
    energyDistributionAbi,
    wallet,
  );

  // Check whitelist
  const isWhitelisted = await energyDistribution.isAddressWhitelisted(
    wallet.address,
  );
  if (!isWhitelisted) {
    throw new Error('Wallet is not whitelisted on EnergyDistribution');
  }
  console.log('✅ Wallet is whitelisted');

  // Get current token
  const currentToken = await energyDistribution.getEnergyTokenAddress();
  console.log(`Current token: ${currentToken}`);
  console.log(`New token: ${newTokenAddress}`);

  if (currentToken.toLowerCase() === newTokenAddress.toLowerCase()) {
    console.log('✅ Token already set, skipping');
    return;
  }

  // Set new token
  console.log('Sending setEnergyToken transaction...');
  const tx = await energyDistribution.setEnergyToken(newTokenAddress);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log('✅ Token updated successfully');

  // Verify
  const verifyToken = await energyDistribution.getEnergyTokenAddress();
  if (verifyToken.toLowerCase() !== newTokenAddress.toLowerCase()) {
    throw new Error('Token verification failed');
  }
  console.log('✅ Verification passed');
}

async function runEmergencyReset(wallet: ethers.Wallet): Promise<void> {
  console.log('\n🚨 Step 6: Running Emergency Reset');
  console.log('='.repeat(60));

  const energyDistribution = new ethers.Contract(
    ENERGY_DISTRIBUTION_ADDRESS,
    energyDistributionAbi,
    wallet,
  );

  // Check zero-sum before reset
  try {
    const [isZeroSum, balance] =
      await energyDistribution.verifyZeroSumProperty();
    console.log(`Zero-sum before reset: ${isZeroSum ? '✅ Yes' : '❌ No'}`);
    console.log(`System balance: ${balance.toString()}`);
  } catch (error) {
    console.log('Could not verify zero-sum property (expected before reset)');
  }

  console.log('\nExecuting emergency reset...');
  const tx = await energyDistribution.emergencyReset();
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log('✅ Emergency reset completed');

  // Verify zero-sum after reset
  try {
    const [isZeroSum, balance] =
      await energyDistribution.verifyZeroSumProperty();
    console.log(`\nZero-sum after reset: ${isZeroSum ? '✅ Yes' : '❌ No'}`);
    console.log(`System balance: ${balance.toString()}`);

    if (!isZeroSum) {
      console.log('⚠️  Warning: System is not in zero-sum state after reset!');
    }
  } catch (error: any) {
    console.log('Could not verify zero-sum property:', error.message);
  }
}

async function verifyCompleteSetup(
  tokenAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log('\n✅ Step 7: Verifying Complete Setup');
  console.log('='.repeat(60));

  const token = new ethers.Contract(tokenAddress, regularSpaceTokenAbi, wallet);
  const energyDistribution = new ethers.Contract(
    ENERGY_DISTRIBUTION_ADDRESS,
    energyDistributionAbi,
    wallet,
  );

  // Check token
  const name = await token.name();
  const decimals = await token.decimals();
  const owner = await token.owner();
  const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);

  console.log('Token Configuration:');
  console.log(`  Name: ${name}`);
  console.log(`  Decimals: ${decimals} ${decimals === 6 ? '✅' : '⚠️'}`);
  console.log(`  Owner: ${owner}`);
  console.log(
    `  EnergyDistribution Authorized: ${isAuthorized ? '✅ Yes' : '❌ No'}`,
  );

  // Check EnergyDistribution
  const currentToken = await energyDistribution.getEnergyTokenAddress();
  console.log('\nEnergyDistribution Configuration:');
  console.log(`  Token Address: ${currentToken}`);
  console.log(
    `  Matches New Token: ${
      currentToken.toLowerCase() === tokenAddress.toLowerCase()
        ? '✅ Yes'
        : '❌ No'
    }`,
  );

  // Check zero-sum
  try {
    const [isZeroSum, balance] =
      await energyDistribution.verifyZeroSumProperty();
    console.log('\nSystem State:');
    console.log(
      `  Zero-Sum Property: ${isZeroSum ? '✅ Maintained' : '❌ Violated'}`,
    );
    console.log(`  System Balance: ${balance.toString()}`);

    if (!isZeroSum) {
      console.log('  ⚠️  WARNING: System is not in zero-sum state!');
    }
  } catch (error: any) {
    console.log('\nSystem State:');
    console.log('  ⚠️  Could not verify zero-sum property:', error.message);
  }

  // Final validation
  if (Number(decimals) !== 6) {
    throw new Error(`Decimals are ${decimals}, expected 6!`);
  }

  if (!isAuthorized) {
    throw new Error('EnergyDistribution is not authorized!');
  }

  if (currentToken.toLowerCase() !== tokenAddress.toLowerCase()) {
    throw new Error('Token address mismatch!');
  }

  console.log('\n✅ All checks passed!');
}

async function main(): Promise<void> {
  console.log('🔧 RegularSpaceToken Integration Setup with Upgrade');
  console.log('='.repeat(60));
  console.log(`Old token: ${OLD_TOKEN_ADDRESS}`);
  console.log(`Proxy address: ${REGULAR_SPACE_TOKEN_PROXY_ADDRESS}`);
  console.log(`EnergyDistribution: ${ENERGY_DISTRIBUTION_ADDRESS}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = await loadWallet(provider);

  console.log(`🔑 Wallet: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  try {
    // Step 1: Deploy new implementation
    const newImplementationAddress = await deployNewImplementation(wallet);

    // Step 2: Upgrade proxy to new implementation
    await upgradeProxy(
      REGULAR_SPACE_TOKEN_PROXY_ADDRESS,
      newImplementationAddress,
      wallet,
    );

    // Step 3: Check token info
    await checkTokenInfo(REGULAR_SPACE_TOKEN_PROXY_ADDRESS, wallet);

    // Step 4: Authorize EnergyDistribution
    await authorizeEnergyDistribution(
      REGULAR_SPACE_TOKEN_PROXY_ADDRESS,
      wallet,
    );

    // Step 5: Update EnergyDistribution
    await updateEnergyDistribution(REGULAR_SPACE_TOKEN_PROXY_ADDRESS, wallet);

    // Step 6: Run emergency reset
    await runEmergencyReset(wallet);

    // Step 7: Verify everything
    await verifyCompleteSetup(REGULAR_SPACE_TOKEN_PROXY_ADDRESS, wallet);

    console.log('\n🎉 SUCCESS! All steps completed!');
    console.log('='.repeat(60));
    console.log(`✅ New Implementation: ${newImplementationAddress}`);
    console.log(`✅ Proxy upgraded: ${REGULAR_SPACE_TOKEN_PROXY_ADDRESS}`);
    console.log(`✅ EnergyDistribution updated`);
    console.log(`✅ Authorization configured`);
    console.log(`✅ Emergency reset completed`);
    console.log(`\n🚀 System is ready to use!`);
  } catch (error: any) {
    console.error('\n❌ Process failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
