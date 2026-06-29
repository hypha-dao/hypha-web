/**
 * Whitelist (or remove) an address on an EnergyPPAv2 community proxy.
 *
 * PPA `owner()` is the space **Executor contract** for UI-deployed communities
 * (not a human wallet). Those communities must whitelist via a **governance
 * proposal** whose `extraTransactions` call `updateWhitelist` on the PPA.
 *
 * Environment:
 *   ENERGY_PPAV2_PPA_PROXY — PPA proxy (optional if state file has ppaProxy)
 *   ENERGY_PPAV2_STATE_FILE — JSON state file (default: energy-ppav2-demo-state.json)
 *   WHITELIST_ADDRESS — address to whitelist (required unless argv[2])
 *   WHITELIST_STATUS — "1"/"true" whitelist, "0"/"false" remove (default: true)
 *   PROPOSAL_ONLY — "1" print proposal calldata and exit (default when owner is contract)
 *   PRIVATE_KEY / ENERGY_ADMIN_PRIVATE_KEY — only for direct send when owner is an EOA
 *
 * Usage (energy3000 — print proposal payload):
 *   WHITELIST_ADDRESS=0x2687… \
 *   ENERGY_PPAV2_STATE_FILE=scripts/base-mainnet-contracts-scripts/energy-ppav2-energy3000-state.json \
 *   PROPOSAL_ONLY=1 \
 *     npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-whitelist.ts --network base-mainnet
 */

import * as fs from 'fs';
import * as path from 'path';

import { ethers } from 'hardhat';

import dotenv from 'dotenv';

dotenv.config();

function getEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  throw new Error(`Invalid boolean env value: ${value}`);
}

function stateFilePath(): string {
  const custom = getEnv('ENERGY_PPAV2_STATE_FILE');
  if (custom)
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  return path.join(__dirname, 'energy-ppav2-demo-state.json');
}

function resolvePpaProxy(): string {
  const direct = getEnv('ENERGY_PPAV2_PPA_PROXY');
  if (direct) {
    if (!ethers.isAddress(direct))
      throw new Error(`Invalid PPA proxy: ${direct}`);
    return direct;
  }

  const statePath = stateFilePath();
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `Set ENERGY_PPAV2_PPA_PROXY or provide state file: ${statePath}`,
    );
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as {
    ppaProxy?: string;
  };
  if (!state.ppaProxy) throw new Error(`Missing ppaProxy in ${statePath}`);
  return state.ppaProxy;
}

function buildUpdateWhitelistCalldata(target: string, status: boolean): string {
  const iface = new ethers.Interface([
    'function updateWhitelist(address account, bool isWhitelisted)',
  ]);
  return iface.encodeFunctionData('updateWhitelist', [target, status]);
}

async function printProposalInstructions(
  ppaProxy: string,
  owner: string,
  target: string,
  status: boolean,
  before: boolean,
): Promise<void> {
  const calldata = buildUpdateWhitelistCalldata(target, status);
  const extraTransaction = {
    target: ppaProxy,
    value: '0',
    data: calldata,
  };

  console.log('\n  PPA owner is a contract (space Executor), not an EOA.');
  console.log(
    '  There is no private key — whitelist via governance proposal.\n',
  );
  console.log('  Flow:');
  console.log('    1. Create a proposal in energy3000 (any proposal type that');
  console.log(
    '       supports extra on-chain transactions, or add a dedicated',
  );
  console.log('       “Whitelist settlement bot” proposal in the UI).');
  console.log('    2. Attach this as an extraTransactions entry (executed by');
  console.log(`       Executor ${owner} when the proposal passes):`);
  console.log(JSON.stringify(extraTransaction, null, 2));
  console.log('\n  After execution, verify:');
  console.log(`    isAddressWhitelisted(${target}) === ${status}`);
  console.log(`    (currently ${before})`);
}

async function main(): Promise<void> {
  const targetArg = process.argv[2];
  const target =
    targetArg ?? getEnv('WHITELIST_ADDRESS') ?? getEnv('WHITELIST_ACCOUNT');
  if (!target) {
    throw new Error(
      'Missing whitelist target. Set WHITELIST_ADDRESS or pass address as script arg.',
    );
  }
  if (!ethers.isAddress(target)) {
    throw new Error(`Invalid address: ${target}`);
  }

  const status = parseBool(getEnv('WHITELIST_STATUS'), true);
  const ppaProxy = resolvePpaProxy();
  const proposalOnly = parseBool(getEnv('PROPOSAL_ONLY'), false);

  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const ppaRead = await ethers.getContractAt('EnergyPPAv2', ppaProxy);

  const owner: string = await ppaRead.owner();
  const ownerCode = await provider.getCode(owner);
  const ownerIsContract = ownerCode !== '0x';
  const before = await ppaRead.isAddressWhitelisted(target);

  console.log('EnergyPPAv2 — updateWhitelist');
  console.log(`  Chain             : ${network.chainId}`);
  console.log(`  PPA proxy         : ${ppaProxy}`);
  console.log(
    `  PPA owner         : ${owner}${
      ownerIsContract ? ' (contract)' : ' (EOA)'
    }`,
  );
  console.log(`  Target            : ${target}`);
  console.log(`  Whitelist         : ${status}`);
  console.log(
    `  Current status    : ${before ? 'whitelisted' : 'not whitelisted'}`,
  );

  if (before === status) {
    console.log('\n  No change needed.');
    return;
  }

  if (ownerIsContract || proposalOnly) {
    await printProposalInstructions(ppaProxy, owner, target, status, before);
    return;
  }

  const adminKey = getEnv('ENERGY_ADMIN_PRIVATE_KEY') ?? getEnv('PRIVATE_KEY');
  if (!adminKey) {
    throw new Error(
      'PPA owner is an EOA. Set PRIVATE_KEY or ENERGY_ADMIN_PRIVATE_KEY to the owner wallet.',
    );
  }

  const signer = new ethers.Wallet(adminKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`  Signer            : ${signerAddress}`);

  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    await printProposalInstructions(ppaProxy, owner, target, status, before);
    throw new Error(`Signer ${signerAddress} is not the PPA owner (${owner}).`);
  }

  const ppa = await ethers.getContractAt('EnergyPPAv2', ppaProxy, signer);
  console.log('\n  Sending updateWhitelist…');
  const tx = await ppa.updateWhitelist(target, status);
  const receipt = await tx.wait();
  console.log(`  TX hash           : ${receipt?.hash}`);
  console.log(`  Gas used          : ${receipt?.gasUsed.toString()}`);

  const after = await ppa.isAddressWhitelisted(target);
  console.log(
    `  After             : ${after ? 'whitelisted' : 'not whitelisted'}`,
  );

  if (after !== status) {
    throw new Error('Whitelist update did not take effect');
  }

  console.log('  Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
