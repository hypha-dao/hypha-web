import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

const energyTokenAbi = [
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
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'authorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function setTokenAuthorization(
  command: string,
  account: string,
  status?: string,
): Promise<void> {
  if (!['set', 'check'].includes(command)) {
    console.error('❌ Invalid command. Use "set" or "check".');
    return;
  }

  if (!ethers.isAddress(account)) {
    console.error(`❌ Invalid account address provided: ${account}`);
    return;
  }

  if (command === 'set' && !status) {
    console.error('❌ Missing authorization status. Use "true" or "false".');
    return;
  }

  console.log(`🔧 Token Authorization Management: ${command}`);
  console.log('='.repeat(70));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data).filter(
        (acc: AccountData) =>
          acc.privateKey &&
          acc.privateKey !== 'YOUR_PRIVATE_KEY_HERE_WITHOUT_0x_PREFIX' &&
          acc.privateKey.length === 64,
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
  console.log(`🔑 Using wallet (Token Owner): ${wallet.address}`);

  const tokenAddress =
    process.env.ENERGY_TOKEN_ADDRESS ||
    '0xE7E8DaE0c4541fCDc563B1bD9A6a85d9aB762080';
  if (!tokenAddress) {
    console.error('❌ ENERGY_TOKEN_ADDRESS not found in .env');
    return;
  }

  const energyToken = new ethers.Contract(tokenAddress, energyTokenAbi, wallet);

  console.log(`📍 EnergyToken Contract: ${await energyToken.getAddress()}`);
  console.log('');

  try {
    if (command === 'check') {
      console.log(`🔎 Checking authorization for: ${account}`);
      const isAuthorized = await energyToken.authorized(account);
      console.log(`✅ Authorization status: ${isAuthorized}`);
    } else if (command === 'set') {
      const authStatus = status!.toLowerCase() === 'true';
      console.log(
        `✍️ Setting authorization for ${account} to ${authStatus}...`,
      );

      const tx = await energyToken.setAuthorized(account, authStatus);
      console.log(`⏳ Authorization tx hash: ${tx.hash}`);
      await tx.wait();
      console.log('✅ Authorization updated successfully!');

      const newStatus = await energyToken.authorized(account);
      console.log(`🔎 New authorization status: ${newStatus}`);
    }
  } catch (error) {
    console.error(`❌ Operation failed:`, error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const scriptNameIndex = args.findIndex((arg) =>
    arg.endsWith('set-token-authorization.ts'),
  );
  const commandArgs =
    scriptNameIndex > -1 ? args.slice(scriptNameIndex + 1) : args;

  // handle `--` if it exists
  if (commandArgs[0] === '--') {
    commandArgs.shift();
  }

  let command = commandArgs[0] || '';
  if (command.startsWith('--')) {
    command = command.slice(2);
  } else if (command.startsWith('-')) {
    command = command.slice(1);
  }

  const account = commandArgs[1];
  const status = commandArgs[2];

  if (!command || !account) {
    console.log(
      'Usage: npm run set-token-auth -- <command> <address> [status]',
    );
    console.log('');
    console.log('Commands:');
    console.log('  - set <address> <true|false>: Set authorization status');
    console.log('  - check <address>: Check authorization status');
    console.log('');
    return;
  }

  await setTokenAuthorization(command, account, status);
}

main().catch(console.error);
