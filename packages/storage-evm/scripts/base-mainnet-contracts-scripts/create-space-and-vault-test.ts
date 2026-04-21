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
  'function deployToken(uint256 spaceId,string name,string symbol,uint256 maxSupply,bool transferable,bool fixedMaxSupply,bool autoMinting,uint256 tokenPrice,address priceCurrencyFeed,bool useTransferWhitelist,bool useReceiveWhitelist,address[] initialTransferWhitelist,address[] initialReceiveWhitelist) external returns (address)',
  'function getSpaceToken(uint256 spaceId) external view returns (address[])',
];

const regularSpaceTokenAbi = [
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function tokenPrice() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice)',
];

const tokenBackingVaultAbi = [
  'function owner() external view returns (address)',
  'function spacesContract() external view returns (address)',
  'function setSpacesContract(address _spacesContract) external',
  'function addBackingToken(uint256 spaceId,address spaceToken,address[] backingTokens,address[] priceFeeds,uint8[] tokenDecimals,uint256[] fundingAmounts,uint256 minimumBackingBps,uint256 redemptionPrice,address redemptionPriceCurrencyFeed,uint256 maxRedemptionBps,uint256 maxRedemptionPeriodDays) external returns (uint256 vaultId)',
  'function setRedeemEnabled(uint256 spaceId,address spaceToken,bool enabled) external',
  'function setRedemptionStartDate(uint256 spaceId,address spaceToken,uint256 startDate) external',
  'function vaultExists(uint256 spaceId,address spaceToken) external view returns (bool)',
  'function getVaultConfig(uint256 spaceId,address spaceToken) external view returns ((uint256 spaceId,address spaceToken,bool redeemEnabled,bool membersOnly,bool whitelistEnabled,uint256 minimumBackingBps,uint256 redemptionStartDate))',
  'function getBackingTokens(uint256 spaceId,address spaceToken) external view returns (address[])',
  'function getBackingBalance(uint256 spaceId,address spaceToken,address backingToken) external view returns (uint256)',
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
        console.log(`⚠️  Failed to read ${label}:`, (err as Error).message);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  return null;
}

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('Missing RPC_URL in env');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = await loadWallet(provider);

  const daoSpaceFactoryAddress =
    process.env.DAO_SPACE_FACTORY_ADDRESS ?? DEFAULT_ADDRESSES.daoSpaceFactory;
  const daoProposalsAddress =
    process.env.DAO_PROPOSALS_ADDRESS ?? DEFAULT_ADDRESSES.daoProposals;
  const regularTokenFactoryAddress =
    process.env.REGULAR_TOKEN_FACTORY_ADDRESS ??
    DEFAULT_ADDRESSES.regularTokenFactory;
  const tokenBackingVaultAddress =
    process.env.TOKEN_BACKING_VAULT_ADDRESS ??
    DEFAULT_ADDRESSES.tokenBackingVault;

  console.log('Using wallet:', wallet.address);
  console.log('Contracts:');
  console.log('- DAOSpaceFactory:', daoSpaceFactoryAddress);
  console.log('- DAOProposals:', daoProposalsAddress);
  console.log('- RegularTokenFactory:', regularTokenFactoryAddress);
  console.log('- TokenBackingVault:', tokenBackingVaultAddress);

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
  const tokenBackingVault = new ethers.Contract(
    tokenBackingVaultAddress,
    tokenBackingVaultAbi,
    wallet,
  );

  // Preflight: vault must point to the same spaces contract used to create spaces.
  const vaultOwner: string = await tokenBackingVault.owner();
  const vaultSpacesContract: string = await tokenBackingVault.spacesContract();
  if (
    vaultSpacesContract.toLowerCase() !== daoSpaceFactoryAddress.toLowerCase()
  ) {
    console.log('\nVault spacesContract mismatch detected:');
    console.log(`- current: ${vaultSpacesContract}`);
    console.log(`- expected: ${daoSpaceFactoryAddress}`);

    if (vaultOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(
        `Vault spacesContract mismatch and signer is not owner (${vaultOwner}). Call setSpacesContract(${daoSpaceFactoryAddress}) on vault first.`,
      );
    }

    console.log('Updating vault spacesContract as owner...');
    const setSpacesTx = await tokenBackingVault.setSpacesContract(
      daoSpaceFactoryAddress,
    );
    console.log(`- setSpacesContract tx: ${setSpacesTx.hash}`);
    await setSpacesTx.wait();
    console.log('✅ Vault spacesContract updated');
  }

  // 1) Create space
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
  console.log(`- createSpace tx: ${spaceTx.hash}`);
  const spaceReceipt = await spaceTx.wait();
  if (!spaceReceipt) throw new Error('Missing createSpace receipt');

  const spaceId = decodeSpaceId(spaceReceipt);
  const executor = await daoSpaceFactory.getSpaceExecutor(spaceId);
  const members = await daoSpaceFactory.getSpaceMembers(spaceId);

  console.log(`- spaceId: ${spaceId}`);
  console.log(`- executor: ${executor}`);
  console.log(`- members: ${members.join(', ')}`);

  // 2) Deploy two regular tokens via space proposal (new deployToken signature)
  console.log('\n=== Step 2: Deploy 2 tokens via proposal ===');
  const deployIface = new ethers.Interface(regularTokenFactoryAbi);
  const zero = ethers.ZeroAddress;

  const spaceTokenName = process.env.SPACE_TOKEN_NAME ?? 'Vault Space Token';
  const spaceTokenSymbol = process.env.SPACE_TOKEN_SYMBOL ?? 'VST';
  const backingTokenName =
    process.env.BACKING_TOKEN_NAME ?? 'Vault Backing Token';
  const backingTokenSymbol = process.env.BACKING_TOKEN_SYMBOL ?? 'VBT';

  const defaultDeployArgs = {
    maxSupply: 0n,
    transferable: true,
    fixedMaxSupply: false,
    autoMinting: false,
    tokenPrice: BigInt(process.env.DEFAULT_TOKEN_PRICE ?? '1000000'),
    priceCurrencyFeed: zero,
    useTransferWhitelist: false,
    useReceiveWhitelist: false,
    initialTransferWhitelist: [] as string[],
    initialReceiveWhitelist: [] as string[],
  };

  const deploySpaceTokenData = deployIface.encodeFunctionData('deployToken', [
    spaceId,
    spaceTokenName,
    spaceTokenSymbol,
    defaultDeployArgs.maxSupply,
    defaultDeployArgs.transferable,
    defaultDeployArgs.fixedMaxSupply,
    defaultDeployArgs.autoMinting,
    defaultDeployArgs.tokenPrice,
    defaultDeployArgs.priceCurrencyFeed,
    defaultDeployArgs.useTransferWhitelist,
    defaultDeployArgs.useReceiveWhitelist,
    defaultDeployArgs.initialTransferWhitelist,
    defaultDeployArgs.initialReceiveWhitelist,
  ]);

  const deployBackingTokenData = deployIface.encodeFunctionData('deployToken', [
    spaceId,
    backingTokenName,
    backingTokenSymbol,
    defaultDeployArgs.maxSupply,
    defaultDeployArgs.transferable,
    defaultDeployArgs.fixedMaxSupply,
    defaultDeployArgs.autoMinting,
    defaultDeployArgs.tokenPrice,
    defaultDeployArgs.priceCurrencyFeed,
    defaultDeployArgs.useTransferWhitelist,
    defaultDeployArgs.useReceiveWhitelist,
    defaultDeployArgs.initialTransferWhitelist,
    defaultDeployArgs.initialReceiveWhitelist,
  ]);

  await createAndExecuteProposal(
    daoProposals,
    spaceId,
    [
      {
        target: regularTokenFactoryAddress,
        value: 0,
        data: deploySpaceTokenData,
      },
      {
        target: regularTokenFactoryAddress,
        value: 0,
        data: deployBackingTokenData,
      },
    ],
    'Deploy space token + backing token',
  );

  const spaceTokens: string[] = await regularTokenFactory.getSpaceToken(
    spaceId,
  );
  if (spaceTokens.length < 2) {
    throw new Error(`Expected at least 2 tokens, got ${spaceTokens.length}`);
  }
  const spaceTokenAddress = spaceTokens[spaceTokens.length - 2];
  const backingTokenAddress = spaceTokens[spaceTokens.length - 1];

  console.log(`- spaceToken: ${spaceTokenAddress}`);
  console.log(`- backingToken: ${backingTokenAddress}`);

  // 3) Mint backing token to executor so vault can fund from msg.sender=executor
  console.log('\n=== Step 3: Mint backing token to executor ===');
  const backingToken = new ethers.Contract(
    backingTokenAddress,
    regularSpaceTokenAbi,
    wallet,
  );
  const backingDecimals = Number(await backingToken.decimals());
  const fundingHuman = process.env.VAULT_FUNDING_AMOUNT ?? '10';
  const fundingAmount = ethers.parseUnits(fundingHuman, backingDecimals);

  const tokenIface = new ethers.Interface(regularSpaceTokenAbi);
  const mintData = tokenIface.encodeFunctionData('mint', [
    executor,
    fundingAmount,
  ]);

  await createAndExecuteProposal(
    daoProposals,
    spaceId,
    [{ target: backingTokenAddress, value: 0, data: mintData }],
    `Mint ${fundingHuman} ${backingTokenSymbol} to executor`,
  );

  const executorBalance = await backingToken.balanceOf(executor);
  console.log(
    `- executor backing balance: ${ethers.formatUnits(
      executorBalance,
      backingDecimals,
    )}`,
  );

  // 4) Create vault through proposal:
  //    approve(backingToken, vault) -> addBackingToken -> setRedeemEnabled -> setRedemptionStartDate
  console.log('\n=== Step 4: Create vault via space proposal ===');
  const vaultIface = new ethers.Interface(tokenBackingVaultAbi);

  const approveData = tokenIface.encodeFunctionData('approve', [
    tokenBackingVaultAddress,
    fundingAmount,
  ]);

  const minBackingBps = BigInt(process.env.MIN_BACKING_BPS ?? '0');
  const redemptionPrice = BigInt(process.env.REDEMPTION_PRICE ?? '1000000');
  const redemptionPriceCurrencyFeed = zero;
  const maxRedemptionBps = BigInt(process.env.MAX_REDEMPTION_BPS ?? '0');
  const maxRedemptionPeriodDays = BigInt(
    process.env.MAX_REDEMPTION_PERIOD_DAYS ?? '14',
  );
  const redemptionStartDate = BigInt(
    process.env.REDEMPTION_START_DATE ??
      Math.floor(Date.now() / 1000 + 120).toString(),
  );

  const addBackingTokenData = vaultIface.encodeFunctionData('addBackingToken', [
    spaceId,
    spaceTokenAddress,
    [backingTokenAddress],
    [zero], // Hypha-backed token path (read tokenPrice on backing token)
    [backingDecimals],
    [fundingAmount],
    minBackingBps,
    redemptionPrice,
    redemptionPriceCurrencyFeed,
    maxRedemptionBps,
    maxRedemptionPeriodDays,
  ]);

  const setRedeemEnabledData = vaultIface.encodeFunctionData(
    'setRedeemEnabled',
    [spaceId, spaceTokenAddress, true],
  );
  const setRedemptionStartDateData = vaultIface.encodeFunctionData(
    'setRedemptionStartDate',
    [spaceId, spaceTokenAddress, redemptionStartDate],
  );

  await createAndExecuteProposal(
    daoProposals,
    spaceId,
    [
      { target: backingTokenAddress, value: 0, data: approveData },
      { target: tokenBackingVaultAddress, value: 0, data: addBackingTokenData },
      {
        target: tokenBackingVaultAddress,
        value: 0,
        data: setRedeemEnabledData,
      },
      {
        target: tokenBackingVaultAddress,
        value: 0,
        data: setRedemptionStartDateData,
      },
    ],
    'Approve + create vault + enable redemption',
  );

  const exists = await tokenBackingVault.vaultExists(
    spaceId,
    spaceTokenAddress,
  );
  console.log(`- vaultExists: ${exists}`);
  if (!exists) throw new Error('Vault was not created');

  const cfg = await readWithRetry('vault config', () =>
    tokenBackingVault.getVaultConfig(spaceId, spaceTokenAddress),
  );
  const backingTokens = await readWithRetry<string[]>(
    'backing token list',
    () => tokenBackingVault.getBackingTokens(spaceId, spaceTokenAddress),
  );
  const backingBalance = await readWithRetry<bigint>('backing balance', () =>
    tokenBackingVault.getBackingBalance(
      spaceId,
      spaceTokenAddress,
      backingTokenAddress,
    ),
  );

  const spaceToken = new ethers.Contract(
    spaceTokenAddress,
    regularSpaceTokenAbi,
    wallet,
  );
  const backingSymbol =
    (await readWithRetry<string>('backing token symbol', () =>
      backingToken.symbol(),
    )) ?? 'UNKNOWN';
  const spaceSymbol =
    (await readWithRetry<string>('space token symbol', () =>
      spaceToken.symbol(),
    )) ?? 'UNKNOWN';
  const spacePrice = await readWithRetry<bigint>('space token price', () =>
    spaceToken.tokenPrice(),
  );
  const backingPrice = await readWithRetry<bigint>('backing token price', () =>
    backingToken.tokenPrice(),
  );

  console.log('\n=== Final Summary ===');
  console.log(`✅ Space created: ${spaceId}`);
  console.log(`✅ Space token: ${spaceTokenAddress} (${spaceSymbol})`);
  console.log(`✅ Backing token: ${backingTokenAddress} (${backingSymbol})`);
  console.log(
    `✅ Space token tokenPrice(): ${spacePrice === null ? 'n/a' : spacePrice}`,
  );
  console.log(
    `✅ Backing token tokenPrice(): ${
      backingPrice === null ? 'n/a' : backingPrice
    }`,
  );
  console.log(`✅ Vault created: ${exists}`);
  if (cfg) {
    console.log(`✅ Redeem enabled: ${cfg.redeemEnabled}`);
    console.log(`✅ Redemption start date: ${cfg.redemptionStartDate}`);
  } else {
    console.log('⚠️  Redeem/start-date read skipped due RPC limits');
  }
  if (backingTokens) {
    console.log(`✅ Backing token list: ${backingTokens.join(', ')}`);
  } else {
    console.log('⚠️  Backing token list read skipped due RPC limits');
  }
  if (backingBalance !== null) {
    console.log(
      `✅ Vault backing balance: ${ethers.formatUnits(
        backingBalance,
        backingDecimals,
      )} ${backingSymbol}`,
    );
  } else {
    console.log('⚠️  Backing balance read skipped due RPC limits');
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
