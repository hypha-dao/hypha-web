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
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function tokenPrice() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
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
    console.log('Vault spacesContract updated');
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
  console.log(`- spaceId: ${spaceId}`);
  console.log(`- executor: ${executor}`);

  // 2) Deploy space token + backing token through proposal.
  // Space token keeps autoMinting off; backing token autoMinting is on.
  console.log('\n=== Step 2: Deploy 2 tokens via proposal ===');
  const deployIface = new ethers.Interface(regularTokenFactoryAbi);
  const zero = ethers.ZeroAddress;

  const spaceTokenName =
    process.env.SPACE_TOKEN_NAME ?? 'Vault Space Token No Mint';
  const spaceTokenSymbol = process.env.SPACE_TOKEN_SYMBOL ?? 'VSNM';
  const backingTokenName =
    process.env.BACKING_TOKEN_NAME ?? 'Vault Backing Auto Mint';
  const backingTokenSymbol = process.env.BACKING_TOKEN_SYMBOL ?? 'VBAM';

  const defaultPrice = BigInt(process.env.DEFAULT_TOKEN_PRICE ?? '1000000');

  const deploySpaceTokenData = deployIface.encodeFunctionData('deployToken', [
    spaceId,
    spaceTokenName,
    spaceTokenSymbol,
    0n,
    true,
    false,
    false, // autoMinting off
    defaultPrice,
    zero,
    false,
    false,
    [],
    [],
  ]);

  const deployBackingTokenData = deployIface.encodeFunctionData('deployToken', [
    spaceId,
    backingTokenName,
    backingTokenSymbol,
    0n,
    true,
    false,
    true, // autoMinting on (key for this scenario)
    defaultPrice,
    zero,
    false,
    false,
    [],
    [],
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
    'Deploy space token + auto-mint backing token',
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

  const backingToken = new ethers.Contract(
    backingTokenAddress,
    regularSpaceTokenAbi,
    wallet,
  );
  const backingDecimals = Number(await backingToken.decimals());
  const fundingHuman = process.env.VAULT_FUNDING_AMOUNT ?? '10';
  const fundingAmount = ethers.parseUnits(fundingHuman, backingDecimals);

  const balanceBefore: bigint = await backingToken.balanceOf(executor);
  const supplyBefore: bigint = await backingToken.totalSupply();
  console.log(
    `- executor backing balance before funding: ${ethers.formatUnits(
      balanceBefore,
      backingDecimals,
    )}`,
  );
  console.log(
    `- backing totalSupply before funding: ${ethers.formatUnits(
      supplyBefore,
      backingDecimals,
    )}`,
  );

  // 3) Create/fund vault in one proposal with NO explicit mint step.
  console.log('\n=== Step 3: Create vault via proposal (no pre-mint) ===');
  const tokenIface = new ethers.Interface(regularSpaceTokenAbi);
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
    [zero],
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
    'Approve + create vault + enable redemption (no mint)',
  );

  const exists = await tokenBackingVault.vaultExists(spaceId, spaceTokenAddress);
  console.log(`- vaultExists: ${exists}`);
  if (!exists) throw new Error('Vault was not created');

  const vaultBalance: bigint = await tokenBackingVault.getBackingBalance(
    spaceId,
    spaceTokenAddress,
    backingTokenAddress,
  );
  const balanceAfter: bigint = await backingToken.balanceOf(executor);
  const supplyAfter: bigint = await backingToken.totalSupply();

  console.log('\n=== Final Summary ===');
  console.log(`Space ID: ${spaceId}`);
  console.log(`Space token: ${spaceTokenAddress}`);
  console.log(`Backing token: ${backingTokenAddress} (autoMinting=true)`);
  console.log(
    `Vault backing balance: ${ethers.formatUnits(vaultBalance, backingDecimals)} ${backingTokenSymbol}`,
  );
  console.log(
    `Executor backing balance before/after: ${ethers.formatUnits(
      balanceBefore,
      backingDecimals,
    )} -> ${ethers.formatUnits(balanceAfter, backingDecimals)}`,
  );
  console.log(
    `Backing totalSupply before/after: ${ethers.formatUnits(
      supplyBefore,
      backingDecimals,
    )} -> ${ethers.formatUnits(supplyAfter, backingDecimals)}`,
  );
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
