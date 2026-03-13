import { ethers } from 'hardhat';

const DEFAULT_VAULT_ADDRESS = '0x9997C22f06F0aC67dF07C8Cb2A08562C53dD4E9f';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function tokenPrice() view returns (uint256)',
];

const TOKEN_BACKING_VAULT_ABI = [
  'function addBackingToken(uint256,address,address[],address[],uint8[],uint256[],uint256,uint256,address,uint256,uint256) external returns (uint256)',
  'function setRedeemEnabled(uint256,address,bool) external',
  'function setRedemptionStartDate(uint256,address,uint256) external',
  'function vaultExists(uint256,address) external view returns (bool)',
  'function getVaultConfig(uint256,address) external view returns ((uint256 spaceId,address spaceToken,bool redeemEnabled,bool membersOnly,bool whitelistEnabled,uint256 minimumBackingBps,uint256 redemptionStartDate))',
];

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const raw = getEnv(name);
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function parseAddressList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function parseUnixOrIsoToUnix(raw: string | undefined): bigint {
  if (!raw) return 0n;
  const asInt = Number(raw);
  if (Number.isInteger(asInt) && asInt > 0) {
    return BigInt(asInt);
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid REDEMPTION_START_DATE value: "${raw}". Use unix seconds or ISO date.`,
    );
  }
  return BigInt(Math.floor(ms / 1000));
}

async function readTokenMeta(
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<void> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, ethers.provider);

  let symbol = 'UNKNOWN';
  let decimals = 18;
  let balance = 0n;
  let allowance = 0n;
  let tokenPrice = 0n;
  let hasTokenPrice = false;

  try {
    symbol = await token.symbol();
  } catch {
    // Non-standard ERC20, keep fallback symbol
  }
  try {
    decimals = Number(await token.decimals());
  } catch {
    // Keep fallback
  }
  try {
    balance = await token.balanceOf(owner);
  } catch {
    // Keep fallback
  }
  try {
    allowance = await token.allowance(owner, spender);
  } catch {
    // Keep fallback
  }
  try {
    tokenPrice = await token.tokenPrice();
    hasTokenPrice = true;
  } catch {
    // Optional method, ignore
  }

  console.log(`\nToken: ${tokenAddress}`);
  console.log(`- Symbol: ${symbol}`);
  console.log(`- Decimals: ${decimals}`);
  console.log(
    `- Balance: ${ethers.formatUnits(balance, decimals)} (${balance})`,
  );
  console.log(
    `- Allowance to vault: ${ethers.formatUnits(
      allowance,
      decimals,
    )} (${allowance})`,
  );
  if (hasTokenPrice) {
    console.log(`- tokenPrice(): ${tokenPrice}`);
  }
}

async function main(): Promise<void> {
  const [wallet] = await ethers.getSigners();
  const walletAddress = await wallet.getAddress();
  const vaultAddress = getEnv('VAULT_ADDRESS') ?? DEFAULT_VAULT_ADDRESS;

  const spaceIdRaw = getEnv('SPACE_ID');
  const spaceToken = getEnv('SPACE_TOKEN');
  const backingToken = getEnv('BACKING_TOKEN');

  const doCreateVault = parseBoolean('CREATE_VAULT', false);
  const doApprove = parseBoolean('AUTO_APPROVE', false);
  const enableRedeem = parseBoolean('ENABLE_REDEEM', false);

  console.log('Wallet:', walletAddress);
  console.log('Vault:', vaultAddress);
  console.log('Network chainId:', (await ethers.provider.getNetwork()).chainId);

  // 1) Check balances for provided token list + relevant tokens
  const configuredList = parseAddressList(getEnv('TOKEN_LIST'));
  const tokensToInspect = new Set<string>(configuredList);
  if (spaceToken) tokensToInspect.add(spaceToken);
  if (backingToken) tokensToInspect.add(backingToken);

  if (tokensToInspect.size === 0) {
    console.log(
      '\nNo TOKEN_LIST/SPACE_TOKEN/BACKING_TOKEN provided for balance checks.',
    );
    console.log(
      'Provide comma-separated TOKEN_LIST to inspect your wallet tokens.',
    );
  } else {
    console.log('\n=== Wallet token checks ===');
    for (const tokenAddress of tokensToInspect) {
      await readTokenMeta(tokenAddress, walletAddress, vaultAddress);
    }
  }

  // 2) Optionally create/fund vault directly from wallet
  if (!doCreateVault) {
    console.log('\nCREATE_VAULT is false; skipping addBackingToken call.');
    return;
  }

  if (!spaceIdRaw || !spaceToken || !backingToken) {
    throw new Error(
      'CREATE_VAULT=true requires SPACE_ID, SPACE_TOKEN, BACKING_TOKEN env vars',
    );
  }

  const spaceId = BigInt(spaceIdRaw);
  const amountHuman = getEnv('FUND_AMOUNT') ?? '0';
  const minBackingBps = BigInt(getEnv('MIN_BACKING_BPS') ?? '0');
  const redemptionPrice = BigInt(getEnv('REDEMPTION_PRICE') ?? '0');
  const redemptionPriceCurrencyFeed =
    getEnv('REDEMPTION_PRICE_CURRENCY_FEED') ?? ZERO_ADDRESS;
  const maxRedemptionBps = BigInt(getEnv('MAX_REDEMPTION_BPS') ?? '0');
  const maxRedemptionPeriodDays = BigInt(
    getEnv('MAX_REDEMPTION_PERIOD_DAYS') ?? '14',
  );
  const priceFeed = getEnv('BACKING_PRICE_FEED') ?? ZERO_ADDRESS;
  const redemptionStartDate = parseUnixOrIsoToUnix(
    getEnv('REDEMPTION_START_DATE'),
  );

  const backing = new ethers.Contract(backingToken, ERC20_ABI, wallet);
  const backingDecimals = Number(await backing.decimals());
  const fundingAmount = ethers.parseUnits(amountHuman, backingDecimals);

  if (doApprove && fundingAmount > 0n) {
    const currentAllowance = await backing.allowance(
      walletAddress,
      vaultAddress,
    );
    if (currentAllowance < fundingAmount) {
      console.log('\nApproving backing token allowance to vault...');
      const approveTx = await backing.approve(vaultAddress, fundingAmount);
      console.log('Approve tx:', approveTx.hash);
      await approveTx.wait();
      console.log('Approve confirmed');
    } else {
      console.log('\nSufficient allowance already present; skipping approve.');
    }
  }

  const vault = new ethers.Contract(
    vaultAddress,
    TOKEN_BACKING_VAULT_ABI,
    wallet,
  );
  const existsBefore = await vault.vaultExists(spaceId, spaceToken);
  console.log('\nVault exists before call:', existsBefore);

  console.log('\nCalling addBackingToken from wallet...');
  const tx = await vault.addBackingToken(
    spaceId,
    spaceToken,
    [backingToken],
    [priceFeed],
    [backingDecimals],
    [fundingAmount],
    minBackingBps,
    redemptionPrice,
    redemptionPriceCurrencyFeed,
    maxRedemptionBps,
    maxRedemptionPeriodDays,
  );
  console.log('addBackingToken tx:', tx.hash);
  await tx.wait();
  console.log('addBackingToken confirmed');

  if (enableRedeem) {
    const tx2 = await vault.setRedeemEnabled(spaceId, spaceToken, true);
    console.log('setRedeemEnabled tx:', tx2.hash);
    await tx2.wait();
    console.log('setRedeemEnabled confirmed');
  }

  if (redemptionStartDate > 0n) {
    const tx3 = await vault.setRedemptionStartDate(
      spaceId,
      spaceToken,
      redemptionStartDate,
    );
    console.log('setRedemptionStartDate tx:', tx3.hash);
    await tx3.wait();
    console.log('setRedemptionStartDate confirmed');
  }

  const existsAfter = await vault.vaultExists(spaceId, spaceToken);
  console.log('\nVault exists after call:', existsAfter);

  const config = await vault.getVaultConfig(spaceId, spaceToken);
  console.log('Vault config:', config);
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
