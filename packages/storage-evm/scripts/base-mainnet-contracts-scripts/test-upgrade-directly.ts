import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

const PROXY_ADDRESS = '0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a';
const NEW_IMPLEMENTATION = '0xEdEDF6a97f2E5FC8D1Cd24D42cc69fd881404068'; // From previous deployment

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

async function main() {
  console.log('🔧 Testing Upgrade Directly with Better Error Handling');
  console.log('='.repeat(60));
  console.log(`Proxy: ${PROXY_ADDRESS}`);
  console.log(`New Implementation: ${NEW_IMPLEMENTATION}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = await loadWallet(provider);

  console.log(`Wallet: ${wallet.address}\n`);

  const proxyAbi = [
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
      name: 'owner',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const proxy = new ethers.Contract(PROXY_ADDRESS, proxyAbi, wallet);

  // Verify ownership
  const owner = await proxy.owner();
  console.log(`Proxy owner: ${owner}`);
  console.log(`Your address: ${wallet.address}`);
  console.log(
    `Are you owner? ${owner.toLowerCase() === wallet.address.toLowerCase()}\n`,
  );

  // Try upgrade with explicit gas limit and better error handling
  console.log('Attempting upgradeToAndCall with empty data...');

  try {
    // First, estimate gas
    console.log('Estimating gas...');
    const gasEstimate = await proxy.upgradeToAndCall.estimateGas(
      NEW_IMPLEMENTATION,
      '0x',
    );
    console.log(`Gas estimate: ${gasEstimate.toString()}`);

    // Send transaction with extra gas
    console.log('Sending transaction with 50% extra gas...');
    const tx = await proxy.upgradeToAndCall(NEW_IMPLEMENTATION, '0x', {
      gasLimit: (gasEstimate * 3n) / 2n,
    });

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log('\n🎉 Upgrade successful!');
  } catch (error: any) {
    console.error('\n❌ Upgrade failed!');
    console.error(`Error code: ${error.code}`);
    console.error(`Error message: ${error.message}`);

    if (error.data) {
      console.error(`Error data: ${error.data}`);
    }

    if (error.transaction) {
      console.error('\nTransaction that would have been sent:');
      console.error(JSON.stringify(error.transaction, null, 2));
    }

    // Try to decode the error
    if (error.data && error.data.startsWith('0x08c379a0')) {
      // Standard revert with reason string
      const reason = ethers.AbiCoder.defaultAbiCoder().decode(
        ['string'],
        '0x' + error.data.slice(10),
      );
      console.error(`\nRevert reason: ${reason[0]}`);
    } else if (error.data) {
      console.error(`\nRaw error data: ${error.data}`);
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFinal error:', error.shortMessage || error.message);
    process.exit(1);
  });
