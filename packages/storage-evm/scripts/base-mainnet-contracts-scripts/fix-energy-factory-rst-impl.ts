/**
 * Repoint an existing EnergyPPAv2Factory to an ABI-compatible
 * RegularSpaceToken implementation.
 *
 * WHY: The live factory used by the app (see `energyPpaV2FactoryAddress` in
 * `packages/core/src/energy/client/contracts.ts`) was deployed wired to a stale
 * RegularSpaceToken implementation that does NOT expose the current 24-argument
 * `initialize(...)`. Since `deployCommunity()` delegatecalls that selector when
 * creating each source's ownership-token proxy, every "Enable Energy Community"
 * proposal execution reverts with `FailedCall()` — surfaced in the app as
 * "There was an error executing the transaction…".
 *
 * This script deploys a fresh, matching RegularSpaceToken implementation and
 * calls `setRegularSpaceTokenImplementation(newImpl)` on the factory. It MUST
 * be run by the factory owner.
 *
 * Usage:
 *   ENERGY_PPAV2_FACTORY=0x5F07320B3C95C6fB0A0D77d707F14aC95A897E90 \
 *   PRIVATE_KEY=<factory owner key> RPC_URL=<base rpc> \
 *   npx hardhat run scripts/base-mainnet-contracts-scripts/fix-energy-factory-rst-impl.ts --network base-mainnet
 *
 * Optional env:
 *   REGULAR_SPACE_TOKEN_IMPL — reuse an existing compatible impl instead of
 *                              deploying a new one (validated before use).
 *   DRY_RUN=true             — validate + report only, send no transactions.
 */

import { ethers } from 'hardhat';

const REGULAR_SPACE_TOKEN_FQN =
  'contracts/RegularSpaceToken.sol:RegularSpaceToken';

// Current factory wired into the app (contracts.ts).
const DEFAULT_FACTORY = '0x5F07320B3C95C6fB0A0D77d707F14aC95A897E90';

function getEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

async function expectedInitSelector(): Promise<string> {
  const RST = await ethers.getContractFactory(REGULAR_SPACE_TOKEN_FQN);
  const selector = RST.interface.getFunction('initialize')?.selector;
  if (!selector) {
    throw new Error('Could not resolve RegularSpaceToken.initialize selector');
  }
  return selector;
}

async function isCompatible(addr: string, selector: string): Promise<boolean> {
  const code = await ethers.provider.getCode(addr);
  if (code === '0x') return false;
  return code.toLowerCase().includes(selector.slice(2).toLowerCase());
}

async function main(): Promise<void> {
  const factoryAddress = getEnv('ENERGY_PPAV2_FACTORY') ?? DEFAULT_FACTORY;
  const dryRun = getEnv('DRY_RUN')?.toLowerCase() === 'true';

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  const network = await ethers.provider.getNetwork();

  console.log('='.repeat(72));
  console.log('FIX EnergyPPAv2Factory → RegularSpaceToken implementation');
  console.log('='.repeat(72));
  console.log(`Network : chainId ${network.chainId}`);
  console.log(`Factory : ${factoryAddress}`);
  console.log(`Signer  : ${signerAddress}`);
  console.log(`Dry run : ${dryRun ? 'YES' : 'NO'}`);

  const factory = await ethers.getContractAt(
    'EnergyPPAv2Factory',
    factoryAddress,
  );

  const owner: string = await factory.owner();
  const currentImpl: string = await factory.regularSpaceTokenImplementation();
  const selector = await expectedInitSelector();
  const currentCompatible = await isCompatible(currentImpl, selector);

  console.log(`\nOwner            : ${owner}`);
  console.log(`Current RST impl : ${currentImpl}`);
  console.log(`Expected selector: ${selector}`);
  console.log(`Current impl compatible? ${currentCompatible ? 'YES' : 'NO'}`);

  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      `Signer ${signerAddress} is not the factory owner ${owner}. Run with the owner key.`,
    );
  }

  if (currentCompatible) {
    console.log(
      '\nNothing to do — current implementation is already compatible.',
    );
    return;
  }

  // Resolve the new implementation (reuse if explicitly provided & compatible).
  let newImpl: string;
  const explicit = getEnv('REGULAR_SPACE_TOKEN_IMPL');
  if (explicit) {
    if (!ethers.isAddress(explicit)) {
      throw new Error(`REGULAR_SPACE_TOKEN_IMPL invalid address: ${explicit}`);
    }
    if (!(await isCompatible(explicit, selector))) {
      throw new Error(
        `REGULAR_SPACE_TOKEN_IMPL ${explicit} does not expose initialize ${selector} (incompatible).`,
      );
    }
    newImpl = explicit;
    console.log(`\nReusing provided RegularSpaceToken impl: ${newImpl}`);
  } else if (dryRun) {
    console.log(
      '\nDRY_RUN=true — would deploy a fresh RegularSpaceToken impl and repoint. No tx sent.',
    );
    return;
  } else {
    console.log('\nDeploying fresh RegularSpaceToken implementation...');
    const RST = await ethers.getContractFactory(REGULAR_SPACE_TOKEN_FQN);
    const rst = await RST.deploy();
    await rst.waitForDeployment();
    newImpl = await rst.getAddress();
    console.log(`  RegularSpaceToken impl: ${newImpl}`);
  }

  if (dryRun) {
    console.log(
      `\nDRY_RUN=true — would setRegularSpaceTokenImplementation(${newImpl}). No tx sent.`,
    );
    return;
  }

  console.log(`\nCalling setRegularSpaceTokenImplementation(${newImpl})...`);
  const tx = await factory.setRegularSpaceTokenImplementation(newImpl);
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  confirmed in block ${receipt?.blockNumber}`);

  const updated: string = await factory.regularSpaceTokenImplementation();
  console.log(`\nUpdated RST impl: ${updated}`);
  if (updated.toLowerCase() !== newImpl.toLowerCase()) {
    throw new Error('Verification failed: implementation did not update.');
  }
  console.log('\nDone. Enable Energy Community proposals can now be executed.');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
