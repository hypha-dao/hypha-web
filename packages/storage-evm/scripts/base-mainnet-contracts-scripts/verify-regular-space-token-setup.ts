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
const REGULAR_SPACE_TOKEN_ADDRESS =
  '0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a';

/**
 * Verification script to check the RegularSpaceToken integration
 * without making any changes to the blockchain
 */

const energyDistributionAbi = [
  {
    inputs: [],
    name: 'getEnergyTokenAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
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
  {
    inputs: [],
    name: 'getExportCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getImportCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCommunityCashCreditBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSettledBalance',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
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
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'executor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spaceId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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

async function verifyTokenConfiguration(
  provider: ethers.JsonRpcProvider,
): Promise<boolean> {
  console.log('\n🔍 Token Configuration');
  console.log('='.repeat(60));

  const token = new ethers.Contract(
    REGULAR_SPACE_TOKEN_ADDRESS,
    regularSpaceTokenAbi,
    provider,
  );

  let allChecksPass = true;

  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const owner = await token.owner();
    const totalSupply = await token.totalSupply();
    const executor = await token.executor();
    const spaceId = await token.spaceId();
    const isAuthorized = await token.authorized(ENERGY_DISTRIBUTION_ADDRESS);

    console.log(`  Token Address: ${REGULAR_SPACE_TOKEN_ADDRESS}`);
    console.log(`  Name: ${name}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(
      `  Decimals: ${decimals} ${decimals === 6 ? '✅' : '❌ (should be 6)'}`,
    );
    console.log(`  Owner: ${owner}`);
    console.log(`  Executor: ${executor}`);
    console.log(`  Space ID: ${spaceId}`);
    console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
    console.log(
      `  EnergyDistribution Authorized: ${isAuthorized ? '✅ Yes' : '❌ No'}`,
    );

    if (decimals !== 6) {
      console.log('  ⚠️  WARNING: Decimals should be 6!');
      allChecksPass = false;
    }

    if (!isAuthorized) {
      console.log('  ⚠️  WARNING: EnergyDistribution is not authorized!');
      allChecksPass = false;
    }

    return allChecksPass;
  } catch (error: any) {
    console.error(`  ❌ Error reading token: ${error.message}`);
    return false;
  }
}

async function verifyEnergyDistributionConfiguration(
  provider: ethers.JsonRpcProvider,
): Promise<boolean> {
  console.log('\n🔍 EnergyDistribution Configuration');
  console.log('='.repeat(60));

  const energyDistribution = new ethers.Contract(
    ENERGY_DISTRIBUTION_ADDRESS,
    energyDistributionAbi,
    provider,
  );

  let allChecksPass = true;

  try {
    const tokenAddress = await energyDistribution.getEnergyTokenAddress();
    const tokenMatches =
      tokenAddress.toLowerCase() === REGULAR_SPACE_TOKEN_ADDRESS.toLowerCase();

    console.log(`  EnergyDistribution Address: ${ENERGY_DISTRIBUTION_ADDRESS}`);
    console.log(`  Token Address: ${tokenAddress}`);
    console.log(`  Expected Token: ${REGULAR_SPACE_TOKEN_ADDRESS}`);
    console.log(`  Addresses Match: ${tokenMatches ? '✅ Yes' : '❌ No'}`);

    if (!tokenMatches) {
      console.log('  ⚠️  WARNING: Token address does not match!');
      allChecksPass = false;
    }

    return allChecksPass;
  } catch (error: any) {
    console.error(`  ❌ Error reading EnergyDistribution: ${error.message}`);
    return false;
  }
}

async function verifySystemState(
  provider: ethers.JsonRpcProvider,
): Promise<boolean> {
  console.log('\n🔍 System State');
  console.log('='.repeat(60));

  const energyDistribution = new ethers.Contract(
    ENERGY_DISTRIBUTION_ADDRESS,
    energyDistributionAbi,
    provider,
  );

  let allChecksPass = true;

  try {
    const [isZeroSum, balance] =
      await energyDistribution.verifyZeroSumProperty();
    const exportBalance = await energyDistribution.getExportCashCreditBalance();
    const importBalance = await energyDistribution.getImportCashCreditBalance();
    const communityBalance =
      await energyDistribution.getCommunityCashCreditBalance();
    const settledBalance = await energyDistribution.getSettledBalance();

    console.log(
      `  Zero-Sum Property: ${isZeroSum ? '✅ Maintained' : '❌ Violated'}`,
    );
    console.log(`  System Balance: ${balance.toString()}`);
    console.log(`  Export Balance: ${exportBalance.toString()}`);
    console.log(`  Import Balance: ${importBalance.toString()}`);
    console.log(`  Community Balance: ${communityBalance.toString()}`);
    console.log(`  Settled Balance: ${settledBalance.toString()}`);

    if (!isZeroSum) {
      console.log('  ⚠️  WARNING: Zero-sum property is violated!');
      console.log(
        `      The system should maintain zero-sum: total of all balances = 0`,
      );
      allChecksPass = false;
    }

    return allChecksPass;
  } catch (error: any) {
    console.error(`  ❌ Error checking system state: ${error.message}`);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('🔎 RegularSpaceToken Integration Verification');
  console.log('='.repeat(60));
  console.log('This script performs READ-ONLY checks.');
  console.log('No transactions will be sent.\n');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  try {
    // Get network info
    const network = await provider.getNetwork();
    console.log(
      `Connected to network: ${network.name} (chainId: ${network.chainId})`,
    );

    // Run all verification checks
    const tokenConfigOk = await verifyTokenConfiguration(provider);
    const energyDistConfigOk = await verifyEnergyDistributionConfiguration(
      provider,
    );
    const systemStateOk = await verifySystemState(provider);

    // Summary
    console.log('\n📊 Verification Summary');
    console.log('='.repeat(60));
    console.log(
      `  Token Configuration: ${tokenConfigOk ? '✅ Pass' : '❌ Fail'}`,
    );
    console.log(
      `  EnergyDistribution Configuration: ${
        energyDistConfigOk ? '✅ Pass' : '❌ Fail'
      }`,
    );
    console.log(`  System State: ${systemStateOk ? '✅ Pass' : '❌ Fail'}`);

    if (tokenConfigOk && energyDistConfigOk && systemStateOk) {
      console.log('\n🎉 All verification checks passed!');
      console.log('The system is properly configured and ready to use.');
    } else {
      console.log('\n⚠️  Some verification checks failed!');
      console.log(
        'Review the warnings above and run the setup script if needed:',
      );
      console.log(
        '  npx ts-node scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts',
      );
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
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
