import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Minimal ABI for SpaceToken transfer + helpers
const spaceTokenAbi = [
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
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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
];

function usage() {
  console.log('Usage:');
  console.log(
    '  npx ts-node scripts/base-mainnet-contracts-scripts/transfer-token.ts <tokenAddress> <toAddress> <amount>',
  );
  console.log('\nEnvironment variables: RPC_URL, PRIVATE_KEY');
}

async function main() {
  const args = process.argv.slice(2);
  const tokenAddress = args[0];
  const to = args[1];
  const amount = args[2];

  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('Missing env. Ensure RPC_URL, PRIVATE_KEY are set.');
    usage();
    process.exit(1);
  }

  if (!tokenAddress || !to || !amount) {
    console.error(
      'Missing or invalid arguments. <tokenAddress>, <toAddress>, and <amount> are required.',
    );
    usage();
    process.exit(1);
  }

  if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(to)) {
    console.error('Invalid address provided for tokenAddress or toAddress.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const cleanPk = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey;
  const wallet = new ethers.Wallet(cleanPk, provider);

  console.log('Configured:');
  console.log(`- RPC_URL: ${rpcUrl}`);
  console.log(`- Wallet: ${wallet.address}`);
  console.log(`- Token Address: ${tokenAddress}`);
  console.log(`- Recipient (to): ${to}`);
  console.log(`- Amount: ${amount}`);

  const spaceToken = new ethers.Contract(tokenAddress, spaceTokenAbi, wallet);

  try {
    const decimals = await spaceToken.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    const senderBalanceBefore = await spaceToken.balanceOf(wallet.address);
    const receiverBalanceBefore = await spaceToken.balanceOf(to);

    console.log(
      `\nSender balance before: ${ethers.formatUnits(
        senderBalanceBefore,
        decimals,
      )}`,
    );
    console.log(
      `Recipient balance before: ${ethers.formatUnits(
        receiverBalanceBefore,
        decimals,
      )}`,
    );

    console.log(`\nInitiating transfer of ${amount} tokens to ${to}...`);
    const tx = await spaceToken.transfer(to, parsedAmount);
    console.log(`Submitted: ${tx.hash}`);
    const rcpt = await tx.wait();
    console.log(`Confirmed in block ${rcpt?.blockNumber}`);

    const senderBalanceAfter = await spaceToken.balanceOf(wallet.address);
    const receiverBalanceAfter = await spaceToken.balanceOf(to);

    console.log(
      `\nSender balance after: ${ethers.formatUnits(
        senderBalanceAfter,
        decimals,
      )}`,
    );
    console.log(
      `Recipient balance after: ${ethers.formatUnits(
        receiverBalanceAfter,
        decimals,
      )}`,
    );
  } catch (err) {
    console.error(`Failed to transfer tokens:`, err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
