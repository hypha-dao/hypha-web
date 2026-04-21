import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

interface SpaceCreationParams {
  unity: number;
  quorum: number;
  votingPowerSource: number;
  exitMethod: number;
  joinMethod: number;
  access: number;
  discoverability: number;
}

interface Transaction {
  target: string;
  value: number;
  data: string;
}

interface ProposalParams {
  spaceId: number;
  duration: number;
  transactions: Transaction[];
}

const DEFAULT_ADDRESSES = {
  daoSpaceFactory: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
  daoProposals: '0x001bA7a00a259Fb12d7936455e292a60FC2bef14',
  regularTokenFactory: '0x95A33EC94de2189893884DaD63eAa19f7390144a',
  tokenBackingVault: '0x9997C22f06F0aC67dF07C8Cb2A08562C53dD4E9f',
};

const daoSpaceFactoryAbi = [
  'function createSpace((uint256 unity,uint256 quorum,uint256 votingPowerSource,uint256 exitMethod,uint256 joinMethod,uint256 access,uint256 discoverability) params) external returns (uint256)',
  'function getSpaceExecutor(uint256 _spaceId) external view returns (address)',
  'function getSpaceMembers(uint256 _spaceId) external view returns (address[])',
];

const daoProposalsAbi = [
  'function createProposal((uint256 spaceId,uint256 duration,(address target,uint256 value,bytes data)[] transactions) params) external returns (uint256)',
  'function vote(uint256 _proposalId, bool _support) external',
  'function getProposalCore(uint256 _proposalId) external view returns (uint256 spaceId,uint256 startTime,uint256 endTime,bool executed,bool expired,uint256 yesVotes,uint256 noVotes,uint256 totalVotingPowerAtSnapshot,address creator)',
];

const regularTokenFactoryAbi = [
  'function deployToken(uint256 spaceId,string name,string symbol,uint256 maxSupply,bool transferable,bool fixedMaxSupply,bool autoMinting,uint256 tokenPrice,address priceCurrencyFeed,bool useTransferWhitelist,bool useReceiveWhitelist,address[] initialTransferWhitelist,address[] initialReceiveWhitelist,uint256 defaultCreditLimit,uint256[] initialCreditWhitelistSpaceIds,address paymentToken,uint256 paymentTokenPricePerToken,uint256 tokensForSale,uint8 purchaseEligibilityMode,uint256[] initialPurchaseWhitelistSpaceIds) external returns (address)',
  'function getSpaceToken(uint256 spaceId) external view returns (address[])',
];

const regularSpaceTokenAbi = [
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function tokenPrice() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
];

const tokenBackingVaultAbi = [
  'function owner() external view returns (address)',
  'function spacesContract() external view returns (address)',
  'function setSpacesContract(address _spacesContract) external',
  'function addBackingToken(uint256 spaceId,address spaceToken,address[] backingTokens,address[] priceFeeds,uint8[] tokenDecimals,uint256[] fundingAmounts,uint256 minimumBackingBps,uint256 redemptionPrice,address redemptionPriceCurrencyFeed,uint256 maxRedemptionBps,uint256 maxRedemptionPeriodDays) external returns (uint256 vaultId)',
  'function redeem(uint256 spaceId,address spaceToken,uint256 spaceTokenAmount,address[] backingTokens,uint256[] proportions) external',
  'function setRedeemEnabled(uint256 spaceId,address spaceToken,bool enabled) external',
  'function setRedemptionStartDate(uint256 spaceId,address spaceToken,uint256 startDate) external',
  'function vaultExists(uint256 spaceId,address spaceToken) external view returns (bool)',
  'function getVaultConfig(uint256 spaceId,address spaceToken) external view returns ((uint256 spaceId,address spaceToken,bool redeemEnabled,bool membersOnly,bool whitelistEnabled,uint256 minimumBackingBps,uint256 redemptionStartDate))',
  'function getBackingTokens(uint256 spaceId,address spaceToken) external view returns (address[])',
  'function getBackingBalance(uint256 spaceId,address spaceToken,address backingToken) external view returns (uint256)',
  'function calculateBackingOut(uint256 spaceId,address spaceToken,uint256 spaceTokenAmount,address backingToken) external view returns (uint256)',
];

async function loadWallet(
  provider: ethers.JsonRpcProvider,
): Promise<ethers.Wallet> {
  let accountData: AccountData[] = [];

  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) accountData = JSON.parse(data);
  } catch {
    // fallback to PRIVATE_KEY env below
  }

  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error(
        'No accounts available. Provide accounts.json or PRIVATE_KEY in .env',
      );
    }
    const clean = privateKey.startsWith('0x')
      ? privateKey.slice(2)
      : privateKey;
    const w = new ethers.Wallet(clean);
    accountData = [{ privateKey: clean, address: w.address }];
  }

  return new ethers.Wallet(accountData[0].privateKey, provider);
}

function decodeProposalId(receipt: ethers.TransactionReceipt): number {
  const topic = ethers.id(
    'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
  );
  const ev = receipt.logs.find((log) => log.topics[0] === topic);
  if (!ev) throw new Error('ProposalCreated event not found');
  return parseInt(ev.topics[1], 16);
}

function decodeSpaceId(receipt: ethers.TransactionReceipt): number {
  const topic = ethers.id(
    'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
  );
  const ev = receipt.logs.find((log) => log.topics[0] === topic);
  if (!ev) throw new Error('SpaceCreated event not found');
  return parseInt(ev.topics[1], 16);
}

async function createAndExecuteProposal(
  daoProposals: ethers.Contract,
  spaceId: number,
  transactions: Transaction[],
  label: string,
): Promise<number> {
  const params: ProposalParams = {
    spaceId,
    duration: Number(process.env.PROPOSAL_DURATION ?? 3600),
    transactions,
  };

  console.log(`\nCreating proposal: ${label}`);
  const tx = await daoProposals.createProposal(params, { gasLimit: 5_000_000 });
  console.log(`- createProposal tx: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Missing createProposal receipt');

  const proposalId = decodeProposalId(receipt);
  console.log(`- proposalId: ${proposalId}`);

  const voteTx = await daoProposals.vote(proposalId, true, {
    gasLimit: 2_000_000,
  });
  console.log(`- vote tx: ${voteTx.hash}`);
  await voteTx.wait();

  const core = await daoProposals.getProposalCore(proposalId);
  console.log(
    `- executed: ${core.executed}, yesVotes: ${core.yesVotes}, noVotes: ${core.noVotes}`,
  );

  if (!core.executed) {
    throw new Error(
      `Proposal ${proposalId} is not executed yet. Re-run or execute manually.`,
    );
  }

  return proposalId;
}

async function readWithRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 4,
  delayMs = 1200,
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = i === attempts - 1;
      if (isLast) {
        console.log(`  Failed to read ${label}:`, (err as Error).message);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  return null;
}

function fmtUnits(value: bigint, decimals: number): string {
  return ethers.formatUnits(value, decimals);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('Missing RPC_URL in env');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = await loadWallet(provider);

  const daoProposalsAddress =
    process.env.DAO_PROPOSALS_ADDRESS ?? DEFAULT_ADDRESSES.daoProposals;
  const regularTokenFactoryAddress =
    process.env.REGULAR_TOKEN_FACTORY_ADDRESS ??
    DEFAULT_ADDRESSES.regularTokenFactory;
  const tokenBackingVaultAddress =
    process.env.TOKEN_BACKING_VAULT_ADDRESS ??
    DEFAULT_ADDRESSES.tokenBackingVault;

  const tokenBackingVault = new ethers.Contract(
    tokenBackingVaultAddress,
    tokenBackingVaultAbi,
    wallet,
  );

  // Always use the canonical factory that the vault was deployed against.
  // The vault checks executor via its spacesContract — both must match.
  // DAO_SPACE_FACTORY_ADDRESS env may point to a newer factory not compatible with this vault.
  const daoSpaceFactoryAddress = DEFAULT_ADDRESSES.daoSpaceFactory;
  const vaultSpacesContract: string = await tokenBackingVault.spacesContract();

  if (
    vaultSpacesContract.toLowerCase() !== daoSpaceFactoryAddress.toLowerCase()
  ) {
    console.log(
      '\nVault spacesContract mismatch — restoring to known-good factory:',
    );
    console.log(`  current:  ${vaultSpacesContract}`);
    console.log(`  target:   ${daoSpaceFactoryAddress}`);

    const vaultOwner: string = await tokenBackingVault.owner();
    if (vaultOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(
        `Vault spacesContract mismatch and signer is not owner (${vaultOwner}). Cannot restore.`,
      );
    }

    const setTx = await tokenBackingVault.setSpacesContract(
      daoSpaceFactoryAddress,
    );
    console.log(`  setSpacesContract tx: ${setTx.hash}`);
    await setTx.wait();
    console.log('  Restored.');
  }

  console.log('=== Multi-Token Redeem Test ===\n');
  console.log('Wallet:', wallet.address);
  console.log('Contracts:');
  console.log('  DAOSpaceFactory:', daoSpaceFactoryAddress);
  console.log('  DAOProposals:', daoProposalsAddress);
  console.log('  RegularTokenFactory:', regularTokenFactoryAddress);
  console.log('  TokenBackingVault:', tokenBackingVaultAddress);

  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  );
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );
  const regularTokenFactory = new ethers.Contract(
    regularTokenFactoryAddress,
    regularTokenFactoryAbi,
    wallet,
  );

  // ──────────────────────────────────────────────────
  // Step 1: Create space
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 1: Create space ===');
  const spaceParams: SpaceCreationParams = {
    unity: Number(process.env.SPACE_UNITY ?? 51),
    quorum: Number(process.env.SPACE_QUORUM ?? 51),
    votingPowerSource: Number(process.env.SPACE_VOTING_POWER_SOURCE ?? 2),
    exitMethod: Number(process.env.SPACE_EXIT_METHOD ?? 2),
    joinMethod: Number(process.env.SPACE_JOIN_METHOD ?? 1),
    access: Number(process.env.SPACE_ACCESS ?? 0),
    discoverability: Number(process.env.SPACE_DISCOVERABILITY ?? 0),
  };

  const spaceTx = await daoSpaceFactory.createSpace(spaceParams);
  console.log(`  createSpace tx: ${spaceTx.hash}`);
  const spaceReceipt = await spaceTx.wait();
  if (!spaceReceipt) throw new Error('Missing createSpace receipt');

  const spaceId = decodeSpaceId(spaceReceipt);
  const executor = await daoSpaceFactory.getSpaceExecutor(spaceId);
  console.log(`  spaceId:  ${spaceId}`);
  console.log(`  executor: ${executor}`);

  // ──────────────────────────────────────────────────
  // Step 2: Deploy 3 tokens via proposal:
  //   - Space token (the redeemable community token)
  //   - Backing token A
  //   - Backing token B
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 2: Deploy 3 tokens (1 space + 2 backing) ===');
  const deployIface = new ethers.Interface(regularTokenFactoryAbi);
  const zero = ethers.ZeroAddress;

  const spaceTokenPrice = BigInt(process.env.SPACE_TOKEN_PRICE ?? '1000000'); // $1
  const backingAPrice = BigInt(process.env.BACKING_A_PRICE ?? '500000'); // $0.50
  const backingBPrice = BigInt(process.env.BACKING_B_PRICE ?? '2000000'); // $2.00

  const makeDeployData = (
    name: string,
    symbol: string,
    price: bigint,
  ): string =>
    deployIface.encodeFunctionData('deployToken', [
      spaceId,
      name,
      symbol,
      0n, // maxSupply (unlimited)
      true, // transferable
      false, // fixedMaxSupply
      false, // autoMinting
      price,
      zero, // priceCurrencyFeed (USD)
      false, // useTransferWhitelist
      false, // useReceiveWhitelist
      [], // initialTransferWhitelist
      [], // initialReceiveWhitelist
      0n, // defaultCreditLimit
      [], // initialCreditWhitelistSpaceIds
      zero, // paymentToken
      0n, // paymentTokenPricePerToken
      0n, // tokensForSale
      0, // purchaseEligibilityMode
      [], // initialPurchaseWhitelistSpaceIds
    ]);

  await createAndExecuteProposal(
    daoProposals,
    spaceId,
    [
      {
        target: regularTokenFactoryAddress,
        value: 0,
        data: makeDeployData('Redeem Test Token', 'RTT', spaceTokenPrice),
      },
      {
        target: regularTokenFactoryAddress,
        value: 0,
        data: makeDeployData('Backing Alpha', 'BALPHA', backingAPrice),
      },
      {
        target: regularTokenFactoryAddress,
        value: 0,
        data: makeDeployData('Backing Beta', 'BBETA', backingBPrice),
      },
    ],
    'Deploy space token + 2 backing tokens',
  );

  await delay(2000);
  const spaceTokens: string[] = await regularTokenFactory.getSpaceToken(
    spaceId,
  );
  if (spaceTokens.length < 3) {
    throw new Error(`Expected >= 3 tokens, got ${spaceTokens.length}`);
  }
  const spaceTokenAddr = spaceTokens[spaceTokens.length - 3];
  const backingAAddr = spaceTokens[spaceTokens.length - 2];
  const backingBAddr = spaceTokens[spaceTokens.length - 1];

  const spaceToken = new ethers.Contract(
    spaceTokenAddr,
    regularSpaceTokenAbi,
    wallet,
  );
  const backingA = new ethers.Contract(
    backingAAddr,
    regularSpaceTokenAbi,
    wallet,
  );
  const backingB = new ethers.Contract(
    backingBAddr,
    regularSpaceTokenAbi,
    wallet,
  );

  await delay(2000);
  const stDecimals = Number(
    (await readWithRetry('st decimals', () => spaceToken.decimals())) ?? 18,
  );
  const baDecimals = Number(
    (await readWithRetry('ba decimals', () => backingA.decimals())) ?? 18,
  );
  const bbDecimals = Number(
    (await readWithRetry('bb decimals', () => backingB.decimals())) ?? 18,
  );

  const stSymbol =
    (await readWithRetry<string>('st symbol', () => spaceToken.symbol())) ??
    'RTT';
  const baSymbol =
    (await readWithRetry<string>('ba symbol', () => backingA.symbol())) ??
    'BALPHA';
  const bbSymbol =
    (await readWithRetry<string>('bb symbol', () => backingB.symbol())) ??
    'BBETA';

  console.log(
    `  Space token:  ${spaceTokenAddr} (${stSymbol}, price=${spaceTokenPrice}, dec=${stDecimals})`,
  );
  console.log(
    `  Backing A:    ${backingAAddr} (${baSymbol}, price=${backingAPrice}, dec=${baDecimals})`,
  );
  console.log(
    `  Backing B:    ${backingBAddr} (${bbSymbol}, price=${backingBPrice}, dec=${bbDecimals})`,
  );

  // ──────────────────────────────────────────────────
  // Step 3: Mint backing tokens to executor +
  //         Mint space tokens to wallet (the redeemer)
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 3: Mint tokens ===');
  const tokenIface = new ethers.Interface(regularSpaceTokenAbi);

  const fundingAHuman = process.env.FUNDING_A_AMOUNT ?? '100';
  const fundingBHuman = process.env.FUNDING_B_AMOUNT ?? '100';
  const redeemHuman = process.env.REDEEM_AMOUNT ?? '10';

  const fundingAAmount = ethers.parseUnits(fundingAHuman, baDecimals);
  const fundingBAmount = ethers.parseUnits(fundingBHuman, bbDecimals);
  const redeemAmount = ethers.parseUnits(redeemHuman, stDecimals);

  await createAndExecuteProposal(
    daoProposals,
    spaceId,
    [
      {
        target: backingAAddr,
        value: 0,
        data: tokenIface.encodeFunctionData('mint', [executor, fundingAAmount]),
      },
      {
        target: backingBAddr,
        value: 0,
        data: tokenIface.encodeFunctionData('mint', [executor, fundingBAmount]),
      },
      {
        target: spaceTokenAddr,
        value: 0,
        data: tokenIface.encodeFunctionData('mint', [
          wallet.address,
          redeemAmount,
        ]),
      },
    ],
    `Mint ${fundingAHuman} BALPHA + ${fundingBHuman} BBETA to executor, ${redeemHuman} RTT to wallet`,
  );

  await delay(1500);
  const exBalA = await readWithRetry<bigint>('executor BALPHA', () =>
    backingA.balanceOf(executor),
  );
  const exBalB = await readWithRetry<bigint>('executor BBETA', () =>
    backingB.balanceOf(executor),
  );
  const walletRtt = await readWithRetry<bigint>('wallet RTT', () =>
    spaceToken.balanceOf(wallet.address),
  );
  console.log(
    `  Executor BALPHA balance: ${
      exBalA !== null ? fmtUnits(exBalA, baDecimals) : 'n/a'
    }`,
  );
  console.log(
    `  Executor BBETA balance:  ${
      exBalB !== null ? fmtUnits(exBalB, bbDecimals) : 'n/a'
    }`,
  );
  console.log(
    `  Wallet RTT balance:      ${
      walletRtt !== null ? fmtUnits(walletRtt, stDecimals) : 'n/a'
    }`,
  );

  // ──────────────────────────────────────────────────
  // Step 4: Create vault with 2 backing tokens via proposal
  //   executor approves vault for both backing tokens,
  //   then addBackingToken with both, enable redemption
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 4: Create vault with 2 backing tokens ===');
  const vaultIface = new ethers.Interface(tokenBackingVaultAbi);

  const approveAData = tokenIface.encodeFunctionData('approve', [
    tokenBackingVaultAddress,
    fundingAAmount,
  ]);
  const approveBData = tokenIface.encodeFunctionData('approve', [
    tokenBackingVaultAddress,
    fundingBAmount,
  ]);

  const minBackingBps = BigInt(process.env.MIN_BACKING_BPS ?? '0');
  const redemptionPrice = BigInt(
    process.env.REDEMPTION_PRICE ?? String(spaceTokenPrice),
  );
  const maxRedemptionBps = BigInt(process.env.MAX_REDEMPTION_BPS ?? '0');
  const maxRedemptionPeriodDays = BigInt(
    process.env.MAX_REDEMPTION_PERIOD_DAYS ?? '14',
  );

  const addBackingTokenData = vaultIface.encodeFunctionData('addBackingToken', [
    spaceId,
    spaceTokenAddr,
    [backingAAddr, backingBAddr],
    [zero, zero], // Both are Hypha-type tokens (price from tokenPrice())
    [baDecimals, bbDecimals],
    [fundingAAmount, fundingBAmount],
    minBackingBps,
    redemptionPrice,
    zero, // redemptionPriceCurrencyFeed = USD
    maxRedemptionBps,
    maxRedemptionPeriodDays,
  ]);

  const setRedeemEnabledData = vaultIface.encodeFunctionData(
    'setRedeemEnabled',
    [spaceId, spaceTokenAddr, true],
  );

  // Set redemption start date to now (already active)
  const redemptionStartDate = BigInt(process.env.REDEMPTION_START_DATE ?? '0');
  const setStartDateData = vaultIface.encodeFunctionData(
    'setRedemptionStartDate',
    [spaceId, spaceTokenAddr, redemptionStartDate],
  );

  await createAndExecuteProposal(
    daoProposals,
    spaceId,
    [
      { target: backingAAddr, value: 0, data: approveAData },
      { target: backingBAddr, value: 0, data: approveBData },
      { target: tokenBackingVaultAddress, value: 0, data: addBackingTokenData },
      {
        target: tokenBackingVaultAddress,
        value: 0,
        data: setRedeemEnabledData,
      },
      { target: tokenBackingVaultAddress, value: 0, data: setStartDateData },
    ],
    'Approve both backing tokens + create vault + enable redemption',
  );

  await delay(1500);
  const exists = await readWithRetry<boolean>('vaultExists', () =>
    tokenBackingVault.vaultExists(spaceId, spaceTokenAddr),
  );
  console.log(`  vaultExists: ${exists}`);
  if (!exists) throw new Error('Vault was not created');

  const cfg = await readWithRetry('vault config', () =>
    tokenBackingVault.getVaultConfig(spaceId, spaceTokenAddr),
  );
  if (cfg) {
    console.log(`  redeemEnabled:       ${cfg.redeemEnabled}`);
    console.log(`  redemptionStartDate: ${cfg.redemptionStartDate}`);
  }

  const vaultBalA =
    (await readWithRetry<bigint>('vault BALPHA', () =>
      tokenBackingVault.getBackingBalance(
        spaceId,
        spaceTokenAddr,
        backingAAddr,
      ),
    )) ?? 0n;
  const vaultBalB =
    (await readWithRetry<bigint>('vault BBETA', () =>
      tokenBackingVault.getBackingBalance(
        spaceId,
        spaceTokenAddr,
        backingBAddr,
      ),
    )) ?? 0n;
  console.log(`  Vault BALPHA balance: ${fmtUnits(vaultBalA, baDecimals)}`);
  console.log(`  Vault BBETA balance:  ${fmtUnits(vaultBalB, bbDecimals)}`);

  // ──────────────────────────────────────────────────
  // Step 5: Preview multi-token redemption amounts
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 5: Preview redemption ===');
  const calcOutA = await readWithRetry<bigint>('calculateBackingOut A', () =>
    tokenBackingVault.calculateBackingOut(
      spaceId,
      spaceTokenAddr,
      redeemAmount,
      backingAAddr,
    ),
  );
  const calcOutB = await readWithRetry<bigint>('calculateBackingOut B', () =>
    tokenBackingVault.calculateBackingOut(
      spaceId,
      spaceTokenAddr,
      redeemAmount,
      backingBAddr,
    ),
  );
  console.log(
    `  If redeeming ${redeemHuman} RTT for 100% BALPHA: ${
      calcOutA !== null ? fmtUnits(calcOutA, baDecimals) : 'n/a'
    } BALPHA`,
  );
  console.log(
    `  If redeeming ${redeemHuman} RTT for 100% BBETA:  ${
      calcOutB !== null ? fmtUnits(calcOutB, bbDecimals) : 'n/a'
    } BBETA`,
  );
  console.log(`  Test will split 60/40 between BALPHA and BBETA`);

  // ──────────────────────────────────────────────────
  // Step 6: Wallet approves vault to spend space tokens
  //   The vault calls burnFrom(wallet, amount), which
  //   consumes a standard ERC20 allowance before burning.
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 6: Approve vault to spend space tokens ===');
  const approveTx = await spaceToken.approve(
    tokenBackingVaultAddress,
    redeemAmount,
  );
  console.log(`  approve tx: ${approveTx.hash}`);
  await approveTx.wait();

  await delay(1500);
  const allowance =
    (await readWithRetry<bigint>('allowance', () =>
      spaceToken.allowance(wallet.address, tokenBackingVaultAddress),
    )) ?? 0n;
  console.log(
    `  Allowance (wallet -> vault): ${fmtUnits(allowance, stDecimals)} RTT`,
  );

  // Snapshot balances before redeem
  const walletRttBefore =
    (await readWithRetry<bigint>('wallet RTT before', () =>
      spaceToken.balanceOf(wallet.address),
    )) ?? 0n;
  const walletBaBefore =
    (await readWithRetry<bigint>('wallet BALPHA before', () =>
      backingA.balanceOf(wallet.address),
    )) ?? 0n;
  const walletBbBefore =
    (await readWithRetry<bigint>('wallet BBETA before', () =>
      backingB.balanceOf(wallet.address),
    )) ?? 0n;
  const supplyBefore =
    (await readWithRetry<bigint>('totalSupply before', () =>
      spaceToken.totalSupply(),
    )) ?? 0n;

  // ──────────────────────────────────────────────────
  // Step 7: REDEEM — multi-token with 60/40 split
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 7: REDEEM (multi-token 60/40 split) ===');
  console.log(`  Redeeming ${redeemHuman} RTT -> 60% BALPHA + 40% BBETA`);

  const proportionA = 6000n; // 60%
  const proportionB = 4000n; // 40%

  const redeemTx = await tokenBackingVault.redeem(
    spaceId,
    spaceTokenAddr,
    redeemAmount,
    [backingAAddr, backingBAddr],
    [proportionA, proportionB],
    { gasLimit: 1_000_000 },
  );
  console.log(`  redeem tx: ${redeemTx.hash}`);
  const redeemReceipt = await redeemTx.wait();
  if (!redeemReceipt) throw new Error('Missing redeem receipt');
  console.log(`  redeem confirmed in block ${redeemReceipt.blockNumber}`);

  // ──────────────────────────────────────────────────
  // Step 8: Verify results
  // ──────────────────────────────────────────────────
  console.log('\n=== Step 8: Verify results ===');

  await delay(1500);
  const walletRttAfter =
    (await readWithRetry<bigint>('wallet RTT after', () =>
      spaceToken.balanceOf(wallet.address),
    )) ?? 0n;
  const walletBaAfter =
    (await readWithRetry<bigint>('wallet BALPHA after', () =>
      backingA.balanceOf(wallet.address),
    )) ?? 0n;
  const walletBbAfter =
    (await readWithRetry<bigint>('wallet BBETA after', () =>
      backingB.balanceOf(wallet.address),
    )) ?? 0n;
  const supplyAfter =
    (await readWithRetry<bigint>('totalSupply after', () =>
      spaceToken.totalSupply(),
    )) ?? 0n;

  const rttBurned = walletRttBefore - walletRttAfter;
  const baReceived = walletBaAfter - walletBaBefore;
  const bbReceived = walletBbAfter - walletBbBefore;
  const supplyBurned = supplyBefore - supplyAfter;

  console.log(`  RTT burned:       ${fmtUnits(rttBurned, stDecimals)}`);
  console.log(`  Supply burned:    ${fmtUnits(supplyBurned, stDecimals)}`);
  console.log(`  BALPHA received:  ${fmtUnits(baReceived, baDecimals)}`);
  console.log(`  BBETA received:   ${fmtUnits(bbReceived, bbDecimals)}`);

  const vaultBalAAfter =
    (await readWithRetry<bigint>('vault BALPHA after', () =>
      tokenBackingVault.getBackingBalance(
        spaceId,
        spaceTokenAddr,
        backingAAddr,
      ),
    )) ?? 0n;
  const vaultBalBAfter =
    (await readWithRetry<bigint>('vault BBETA after', () =>
      tokenBackingVault.getBackingBalance(
        spaceId,
        spaceTokenAddr,
        backingBAddr,
      ),
    )) ?? 0n;

  console.log(
    `  Vault BALPHA: ${fmtUnits(vaultBalA, baDecimals)} -> ${fmtUnits(
      vaultBalAAfter,
      baDecimals,
    )}`,
  );
  console.log(
    `  Vault BBETA:  ${fmtUnits(vaultBalB, bbDecimals)} -> ${fmtUnits(
      vaultBalBAfter,
      bbDecimals,
    )}`,
  );

  // Validate
  const allPassed =
    rttBurned === redeemAmount &&
    supplyBurned === redeemAmount &&
    baReceived > 0n &&
    bbReceived > 0n;

  console.log('\n=== Summary ===');
  console.log(`  Space ID:       ${spaceId}`);
  console.log(`  Space token:    ${spaceTokenAddr}`);
  console.log(`  Backing A:      ${backingAAddr}`);
  console.log(`  Backing B:      ${backingBAddr}`);
  console.log(`  Redeemed:       ${fmtUnits(rttBurned, stDecimals)} RTT`);
  console.log(
    `  Received:       ${fmtUnits(baReceived, baDecimals)} BALPHA + ${fmtUnits(
      bbReceived,
      bbDecimals,
    )} BBETA`,
  );
  console.log(
    `  Result:         ${
      allPassed
        ? 'PASS - Multi-token redeem successful'
        : 'FAIL - Check results above'
    }`,
  );
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
