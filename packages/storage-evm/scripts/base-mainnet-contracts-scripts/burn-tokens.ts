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
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'burnFrom',
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
    inputs: [],
    name: 'totalMinted',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'pendingRewards',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function usage(): void {
  console.log(
    'Usage: npx tsx burn-tokens.ts <fromAddress> <amount> [hyphaTokenAddress] [--dry-run]',
  );
  console.log('Example: npx tsx burn-tokens.ts 0xabc... 100.5 --dry-run');
  console.log('');
  console.log(
    'Note: Only the contract owner can burn tokens from any address.',
  );
  console.log(
    'This will also forfeit any unclaimed rewards for the burned tokens.',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fromAddress = args[0];
  const amountStr = args[1];
  const hyphaArg = args[2] && !args[2].startsWith('-') ? args[2] : undefined;
  const dryRun = args.includes('--dry-run');

  if (!fromAddress || !amountStr) {
    usage();
    process.exit(1);
  }
  if (!ethers.isAddress(fromAddress)) {
    throw new Error(`Invalid from address: ${fromAddress}`);
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
  const [decimalsRaw, totalSupply, totalMinted, contractOwner] =
    await Promise.all([
      hyphaToken.decimals(),
      hyphaToken.totalSupply(),
      hyphaToken.totalMinted(),
      hyphaToken.owner(),
    ]);
  const decimals =
    typeof decimalsRaw === 'bigint' ? Number(decimalsRaw) : decimalsRaw;

  if (dryRun) {
    const [targetBalance, pendingRewards, isOwner] = await Promise.all([
      hyphaToken.balanceOf(fromAddress),
      hyphaToken.pendingRewards(fromAddress),
      Promise.resolve(
        wallet.address.toLowerCase() === contractOwner.toLowerCase(),
      ),
    ]);

    const hasInsufficientBalance = targetBalance < amountWei;

    let staticOk = false;
    let staticError: string | undefined;
    try {
      // Static simulation
      await hyphaToken.burnFrom.staticCall(fromAddress, amountWei);
      staticOk = true;
    } catch (e: any) {
      staticError = e?.shortMessage || e?.message || String(e);
    }

    let gasEstimate: bigint | undefined;
    try {
      gasEstimate = await hyphaToken.burnFrom.estimateGas(
        fromAddress,
        amountWei,
      );
    } catch {
      // ignore
    }

    const summary = {
      from: fromAddress,
      amountInput: amountStr,
      decimals,
      amountWei: amountWei.toString(),
      amountFormatted: ethers.formatUnits(amountWei, decimals),
      hyphaToken: hyphaTokenAddress,
      caller: wallet.address,
      contractOwner,
      callerIsOwner: isOwner,
      targetBalance: targetBalance.toString(),
      targetBalanceFormatted: ethers.formatUnits(targetBalance, decimals),
      targetBalanceAfter: (targetBalance - amountWei).toString(),
      targetBalanceAfterFormatted: ethers.formatUnits(
        targetBalance - amountWei,
        decimals,
      ),
      pendingRewards: pendingRewards.toString(),
      pendingRewardsFormatted: ethers.formatUnits(pendingRewards, decimals),
      totalSupplyBefore: totalSupply.toString(),
      totalSupplyAfter: (totalSupply - amountWei).toString(),
      totalMinted: totalMinted.toString(),
      insufficientBalance: hasInsufficientBalance,
      staticSimulationOk: staticOk,
      staticError: staticError || null,
      gasEstimate: gasEstimate ? gasEstimate.toString() : null,
      warningRewardsForfeited:
        pendingRewards > 0n
          ? 'Target address will lose unclaimed rewards!'
          : null,
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

  // Warn if caller is not owner (tx would revert)
  const isOwner = wallet.address.toLowerCase() === contractOwner.toLowerCase();
  if (!isOwner) {
    console.warn(
      `Warning: Caller ${wallet.address} is not the contract owner (${contractOwner}). Transaction will revert.`,
    );
  }

  // Check if target has sufficient balance
  const targetBalance = await hyphaToken.balanceOf(fromAddress);
  if (targetBalance < amountWei) {
    console.warn(
      `Warning: Target address ${fromAddress} has insufficient balance. Has: ${ethers.formatUnits(
        targetBalance,
        18,
      )} HYPHA, trying to burn: ${ethers.formatUnits(amountWei, 18)} HYPHA`,
    );
  }

  // Check for pending rewards that will be forfeited
  const pendingRewards = await hyphaToken.pendingRewards(fromAddress);
  if (pendingRewards > 0n) {
    console.warn(
      `Warning: Target address ${fromAddress} has ${ethers.formatUnits(
        pendingRewards,
        18,
      )} HYPHA in unclaimed rewards that will be FORFEITED!`,
    );
  }

  console.log(
    `Burning ${ethers.formatUnits(
      amountWei,
      18,
    )} HYPHA from ${fromAddress} via ${hyphaTokenAddress}...`,
  );

  if (pendingRewards > 0n) {
    console.log(
      `⚠️  This will forfeit ${ethers.formatUnits(
        pendingRewards,
        18,
      )} HYPHA in unclaimed rewards!`,
    );
  }

  const tx = await hyphaToken.burnFrom(fromAddress, amountWei);
  console.log('Tx sent:', tx.hash);
  await tx.wait();
  console.log('Burn successful.');

  // Show final state
  const finalBalance = await hyphaToken.balanceOf(fromAddress);
  const finalTotalSupply = await hyphaToken.totalSupply();
  console.log(
    `Final balance of ${fromAddress}: ${ethers.formatUnits(
      finalBalance,
      18,
    )} HYPHA`,
  );
  console.log(
    `New total supply: ${ethers.formatUnits(finalTotalSupply, 18)} HYPHA`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
