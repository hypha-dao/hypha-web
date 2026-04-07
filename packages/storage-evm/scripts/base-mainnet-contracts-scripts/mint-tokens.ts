import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  const patterns = {
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
  } as const;

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const hyphaTokenAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isMintTransferWhitelisted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
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
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalMinted',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_SUPPLY',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function usage(): void {
  console.log(
    'Usage: npx tsx mint-tokens.ts <toAddress> <amount> [hyphaTokenAddress] [--dry-run]',
  );
  console.log('Example: npx tsx mint-tokens.ts 0xabc... 100.5 --dry-run');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const toAddress = args[0];
  const amountStr = args[1];
  const hyphaArg = args[2] && !args[2].startsWith('-') ? args[2] : undefined;
  const dryRun = args.includes('--dry-run');

  if (!toAddress || !amountStr) {
    usage();
    process.exit(1);
  }
  if (!ethers.isAddress(toAddress)) {
    throw new Error(`Invalid recipient address: ${toAddress}`);
  }

  let amountWei: bigint;
  try {
    amountWei = ethers.parseUnits(amountStr, 18);
  } catch {
    throw new Error(
      `Invalid amount: ${amountStr}. Use a decimal string, e.g., 100 or 0.5`,
    );
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  let hyphaTokenAddress = hyphaArg;
  if (hyphaTokenAddress && !ethers.isAddress(hyphaTokenAddress)) {
    throw new Error(`Invalid HyphaToken address: ${hyphaTokenAddress}`);
  }
  if (!hyphaTokenAddress) {
    const addresses = parseAddressesFile();
    hyphaTokenAddress = addresses['HyphaToken'];
  }
  if (!hyphaTokenAddress) {
    throw new Error(
      'HyphaToken address not found. Provide it as the third arg or ensure contracts/addresses.txt contains it.',
    );
  }

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  );

  // Common info
  const [decimalsRaw, totalMinted, maxSupply] = await Promise.all([
    hyphaToken.decimals(),
    hyphaToken.totalMinted(),
    hyphaToken.MAX_SUPPLY(),
  ]);
  const decimals =
    typeof decimalsRaw === 'bigint' ? Number(decimalsRaw) : decimalsRaw;

  if (dryRun) {
    const [recipientBalanceBefore, callerWhitelisted] = await Promise.all([
      hyphaToken.balanceOf(toAddress),
      hyphaToken.isMintTransferWhitelisted(wallet.address),
    ]);

    const willExceedMax = totalMinted + amountWei > maxSupply;

    let staticOk = false;
    let staticError: string | undefined;
    try {
      // Static simulation
      await hyphaToken.mint.staticCall(toAddress, amountWei);
      staticOk = true;
    } catch (e: any) {
      staticError = e?.shortMessage || e?.message || String(e);
    }

    let gasEstimate: bigint | undefined;
    try {
      gasEstimate = await hyphaToken.mint.estimateGas(toAddress, amountWei);
    } catch {
      // ignore
    }

    const summary = {
      to: toAddress,
      amountInput: amountStr,
      decimals,
      amountWei: amountWei.toString(),
      amountFormatted: ethers.formatUnits(amountWei, decimals),
      hyphaToken: hyphaTokenAddress,
      caller: wallet.address,
      callerWhitelisted,
      totalMinted: totalMinted.toString(),
      maxSupply: maxSupply.toString(),
      exceedsMaxSupply: willExceedMax,
      recipientBalanceBefore: recipientBalanceBefore.toString(),
      recipientBalanceAfter: (recipientBalanceBefore + amountWei).toString(),
      staticSimulationOk: staticOk,
      staticError: staticError || null,
      gasEstimate: gasEstimate ? gasEstimate.toString() : null,
    } as const;

    // Replace any stray BigInt values just in case
    const json = JSON.stringify(
      summary,
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    );
    console.log(json);
    return; // do not send tx
  }

  // Warn if caller is not whitelisted (tx would revert)
  const callerWhitelisted: boolean = await hyphaToken.isMintTransferWhitelisted(
    wallet.address,
  );
  if (!callerWhitelisted) {
    console.warn(
      `Warning: Caller ${wallet.address} is not in mintTransferWhitelist. Transaction will revert unless whitelisted.`,
    );
  }

  console.log(
    `Minting ${ethers.formatUnits(
      amountWei,
      18,
    )} HYPHA to ${toAddress} via ${hyphaTokenAddress}...`,
  );
  const tx = await hyphaToken.mint(toAddress, amountWei);
  console.log('Tx sent:', tx.hash);
  await tx.wait();
  console.log('Mint successful.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
