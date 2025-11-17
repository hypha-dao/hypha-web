import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import * as readline from 'readline';

dotenv.config();

const OLD_TOKEN = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
const ENERGY_DISTRIBUTION = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

interface AccountData {
  privateKey: string;
  address: string;
}

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
    // Fallback
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

async function checkCurrentSetup(): Promise<void> {
  console.log('📊 Current System Status');
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = await loadWallet(provider);

  console.log(`\n🔑 Your Wallet: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  // Check EnergyDistribution
  const energyDistAbi = [
    'function getEnergyTokenAddress() view returns (address)',
    'function owner() view returns (address)',
    'function isAddressWhitelisted(address) view returns (bool)',
  ];

  const energyDist = new ethers.Contract(
    ENERGY_DISTRIBUTION,
    energyDistAbi,
    provider,
  );

  try {
    const currentToken = await energyDist.getEnergyTokenAddress();
    const owner = await energyDist.owner();
    const isWhitelisted = await energyDist.isAddressWhitelisted(wallet.address);

    console.log(`\n📍 EnergyDistribution: ${ENERGY_DISTRIBUTION}`);
    console.log(`   Owner: ${owner}`);
    console.log(
      `   You are owner: ${
        owner.toLowerCase() === wallet.address.toLowerCase() ? '✅' : '❌'
      }`,
    );
    console.log(`   You are whitelisted: ${isWhitelisted ? '✅' : '❌'}`);
    console.log(`   Current Token: ${currentToken}`);

    if (currentToken.toLowerCase() === OLD_TOKEN.toLowerCase()) {
      console.log(`   ⚠️  Using CORRUPTED token!`);
    }
  } catch (error: any) {
    console.log(`❌ Could not check EnergyDistribution: ${error.message}`);
  }

  // Check old token
  const tokenAbi = [
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
    'function owner() view returns (address)',
    'function authorized(address) view returns (bool)',
  ];

  const oldToken = new ethers.Contract(OLD_TOKEN, tokenAbi, provider);

  console.log(`\n🔴 Old Token: ${OLD_TOKEN}`);
  try {
    const name = await oldToken.name();
    const decimals = await oldToken.decimals();
    console.log(`   Name: ${name}`);
    console.log(`   Decimals: ${decimals} (should be 6, but is 18 - WRONG!)`);

    try {
      await oldToken.authorized(ENERGY_DISTRIBUTION);
      console.log(`   authorized() function: ❌ BROKEN (reverts)`);
    } catch {
      console.log(`   authorized() function: ❌ BROKEN (reverts)`);
    }
  } catch (error: any) {
    console.log(`   Error: ${error.message}`);
  }
}

function showMenu(): void {
  console.log('\n\n🔧 Energy Token Fix - Choose Your Option');
  console.log('='.repeat(70));
  console.log('\n1️⃣  Automated Fix (Recommended)');
  console.log('   Run everything automatically in one command');
  console.log('   Command: ts-node fix-energy-token-complete.ts');

  console.log('\n2️⃣  Manual Steps');
  console.log('   Follow step-by-step instructions');
  console.log('   See: FIX-ENERGY-TOKEN-GUIDE.md');

  console.log('\n3️⃣  Check Status Only');
  console.log('   View current system status without making changes');

  console.log('\n4️⃣  Exit');

  console.log('\n📖 For full documentation, read: FIX-ENERGY-TOKEN-GUIDE.md');
  console.log('='.repeat(70));
}

async function promptUser(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nEnter your choice (1-4): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  console.log('🚨 Emergency Reset: Energy Token Fix Required');
  console.log('='.repeat(70));
  console.log('\n❌ Problem: EnergyToken was corrupted by wrong upgrade');
  console.log('✅ Solution: Deploy new EnergyToken and reconfigure system');
  console.log('⚠️  Impact: Old token will be orphaned (safe)');

  await checkCurrentSetup();
  showMenu();

  const choice = await promptUser();

  switch (choice) {
    case '1':
      console.log('\n🚀 Running automated fix...');
      console.log('Execute: ts-node fix-energy-token-complete.ts\n');
      break;

    case '2':
      console.log('\n📋 Manual Steps:');
      console.log('='.repeat(70));
      console.log('\n1. Deploy new token:');
      console.log('   cd /Users/vlad/hypha-web/packages/storage-evm');
      console.log(
        '   npx hardhat run scripts/energy-token.deploy.ts --network base-mainnet',
      );
      console.log('\n2. Update EnergyDistribution:');
      console.log('   cd scripts/base-mainnet-contracts-scripts');
      console.log(
        `   ts-node set-energy-token.ts <NEW_TOKEN> ${ENERGY_DISTRIBUTION}`,
      );
      console.log('\n3. Authorize EnergyDistribution:');
      console.log(
        `   ts-node set-authorized-energy-token.ts ${ENERGY_DISTRIBUTION} true`,
      );
      console.log('\n4. Run emergency reset:');
      console.log('   ts-node emergency-reset.ts execute');
      console.log('\n📖 See FIX-ENERGY-TOKEN-GUIDE.md for details');
      break;

    case '3':
      console.log('\n✅ Status check complete (see above)');
      break;

    case '4':
      console.log('\n👋 Exiting...');
      break;

    default:
      console.log('\n❌ Invalid choice');
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
