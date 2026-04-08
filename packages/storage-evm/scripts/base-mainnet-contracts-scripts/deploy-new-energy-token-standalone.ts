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

/**
 * Deploy a new EnergyToken contract using ethers.js directly
 * This deploys the non-upgradeable EnergyToken.sol contract
 */

// EnergyToken bytecode and ABI - from compiled contract
const energyTokenAbi = [
  {
    inputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'address', name: 'initialOwner', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'pure',
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
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
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
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
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
    throw new Error('No wallet found in accounts.json or PRIVATE_KEY env var');
  }

  return new ethers.Wallet(accountData[0].privateKey, provider);
}

async function main(): Promise<void> {
  console.log('🚀 Deploying New EnergyToken Contract');
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = await loadWallet(provider);

  console.log(`🔑 Deployer: ${wallet.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(
      await provider.getBalance(wallet.address),
    )} ETH\n`,
  );

  console.log('⚠️  IMPORTANT: This will deploy using Hardhat');
  console.log('⚠️  Standalone deployment requires compiled bytecode\n');

  console.log('📋 Deployment Steps:');
  console.log('='.repeat(60));
  console.log('\n1️⃣  Deploy new EnergyToken:');
  console.log('   cd /Users/vlad/hypha-web/packages/storage-evm');
  console.log(
    '   npx hardhat run scripts/energy-token.deploy.ts --network base-mainnet\n',
  );

  console.log('2️⃣  Note the deployed token address from output\n');

  console.log('3️⃣  Update EnergyDistribution to use new token:');
  console.log('   cd scripts/base-mainnet-contracts-scripts');
  console.log(
    `   ts-node set-energy-token.ts <NEW_TOKEN_ADDRESS> ${ENERGY_DISTRIBUTION_ADDRESS}\n`,
  );

  console.log('4️⃣  Authorize EnergyDistribution in new token:');
  console.log(
    `   ts-node set-authorized-energy-token.ts ${ENERGY_DISTRIBUTION_ADDRESS} true\n`,
  );

  console.log('5️⃣  Run emergency reset:');
  console.log('   ts-node emergency-reset.ts execute\n');

  console.log('💡 Tips:');
  console.log(
    '   - The old token at 0xd8724e6609838a54F7e505679BF6818f1A3F2D40 will be orphaned',
  );
  console.log('   - All new balances will be tracked in the new token');
  console.log('   - This is safer than trying to fix the corrupted proxy');

  console.log('\n🤖 Or run the automated script:');
  console.log('   ts-node fix-energy-token-complete.ts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
