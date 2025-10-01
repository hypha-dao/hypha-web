import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// Energy Distribution contract ABI - key functions only
const energyDistributionAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'bool', name: 'isWhitelisted', type: 'bool' },
    ],
    name: 'updateWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isAddressWhitelisted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function manageWhitelist(
  command: string,
  addresses: string[],
): Promise<void> {
  if (!['add', 'remove', 'check'].includes(command)) {
    console.error('❌ Invalid command. Use "add", "remove", or "check".');
    return;
  }

  if (addresses.length === 0) {
    console.error('❌ No addresses provided.');
    return;
  }

  console.log(`🔧 Starting Whitelist Management: ${command}`);
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data).filter(
        (account: AccountData) =>
          account.privateKey &&
          account.privateKey !== 'YOUR_PRIVATE_KEY_HERE_WITHOUT_0x_PREFIX' &&
          account.privateKey.length === 64,
      );
    }
  } catch (error) {
    console.log('accounts.json not found. Using environment variables.');
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
    console.error(
      '❌ No accounts found. Please create accounts.json or set PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Using wallet: ${wallet.address}`);

  const energyDistributionAddress =
    process.env.ENERGY_DISTRIBUTION_ADDRESS ||
    '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';

  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  );

  console.log(`📍 Energy Distribution Contract: ${energyDistribution.target}`);
  console.log('');

  for (const address of addresses) {
    if (!ethers.isAddress(address)) {
      console.error(`❌ Invalid address: ${address}`);
      continue;
    }

    console.log(`Processing address: ${address}`);

    try {
      if (command === 'add') {
        const tx = await energyDistribution.updateWhitelist(address, true);
        console.log(`⏳ Whitelist add tx: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Address ${address} added to whitelist.`);
      } else if (command === 'remove') {
        const tx = await energyDistribution.updateWhitelist(address, false);
        console.log(`⏳ Whitelist remove tx: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Address ${address} removed from whitelist.`);
      } else if (command === 'check') {
        const isWhitelisted = await energyDistribution.isAddressWhitelisted(
          address,
        );
        console.log(`🔎 Address ${address} is whitelisted: ${isWhitelisted}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process address ${address}:`, error);
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scriptNameIndex = args.findIndex((arg) =>
    arg.endsWith('manage-whitelist.ts'),
  );
  const commandArgs =
    scriptNameIndex > -1 ? args.slice(scriptNameIndex + 1) : args;

  // handle `--` if it exists
  if (commandArgs[0] === '--') {
    commandArgs.shift();
  }

  const command = commandArgs[0];
  const addresses = commandArgs.slice(1);

  console.log('⚡ Energy Distribution Whitelist Tool');
  console.log('');

  if (!command) {
    console.log('Usage: npm run manage-whitelist <command> <addresses...>');
    console.log('');
    console.log('Available commands:');
    console.log('  - add: Add one or more addresses to the whitelist');
    console.log('  - remove: Remove one or more addresses from the whitelist');
    console.log(
      '  - check: Check if one or more addresses are in the whitelist',
    );
    console.log('');
    return;
  }

  await manageWhitelist(command, addresses);
}

main().catch(console.error);
