import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

const ENERGY_DISTRIBUTION_ADDRESS =
  '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

interface AccountData {
  privateKey: string;
  address: string;
}

/**
 * Deploy a NEW EnergyToken and configure EnergyDistribution to use it
 * This is safer than trying to fix the corrupted proxy
 */
async function main(): Promise<void> {
  console.log('🚀 Deploying New EnergyToken');
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load wallet
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

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Deployer: ${wallet.address}\n`);

  // EnergyToken bytecode and ABI would need to be compiled
  // For now, let's show what needs to be done

  console.log('⚠️  MANUAL STEPS REQUIRED:');
  console.log('='.repeat(60));
  console.log('\n1. Deploy new Energy Token:');
  console.log('   cd /Users/vlad/hypha-web/packages/storage-evm');
  console.log(
    '   npx hardhat run scripts/energy-token.deploy.ts --network base',
  );
  console.log('\n2. Note the new token address');
  console.log('\n3. Update EnergyDistribution to use new token:');
  console.log('   ts-node set-energy-token.ts <new-token-address>');
  console.log('\n4. Authorize EnergyDistribution in new token:');
  console.log(
    '   ts-node set-authorized-energy-token.ts <energy-dist-address> true',
  );
  console.log('\n5. Run emergency reset:');
  console.log('   ts-node emergency-reset.ts execute');

  console.log('\n💡 This approach avoids the storage corruption issue');
  console.log(
    "💡 The old token will be orphaned but that's safer than corruption",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
