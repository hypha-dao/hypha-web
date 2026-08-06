/**
 * Tops the minting relayer up with ETH on Base.
 *
 *   node scripts/fund-relayer.mjs 0.0005          # dry run
 *   node scripts/fund-relayer.mjs 0.0005 --execute
 *
 * The relayer pays gas for every RSUT mint, so an empty one fails every grant.
 * Funds come from PRIVATE_KEY in packages/storage-evm/.env — the same key the
 * contract scripts use — and the relayer address is derived from
 * RSUT_RELAYER_PRIVATE_KEY here, so neither key is ever passed on the command
 * line or printed.
 */
import { readFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

function envFrom(path, name) {
  try {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    const match = new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm').exec(text);
    return match?.[1]?.trim().replace(/^["']|["']$/g, '') || undefined;
  } catch {
    return undefined;
  }
}

const amount = process.argv[2];
const execute = process.argv.includes('--execute');

if (!amount || Number.isNaN(Number(amount))) {
  console.error('Usage: node scripts/fund-relayer.mjs <eth amount> [--execute]');
  process.exit(1);
}

const relayerKey = envFrom('../.env', 'RSUT_RELAYER_PRIVATE_KEY');
const ownerKey = envFrom('../../../packages/storage-evm/.env', 'PRIVATE_KEY');

if (!relayerKey) {
  console.error('No RSUT_RELAYER_PRIVATE_KEY in apps/regen-sydney/.env — run new-relayer.mjs.');
  process.exit(1);
}
if (!ownerKey) {
  console.error('No PRIVATE_KEY in packages/storage-evm/.env.');
  process.exit(1);
}

const withPrefix = (k) => (k.startsWith('0x') ? k : `0x${k}`);
const relayer = privateKeyToAccount(withPrefix(relayerKey));
const funder = privateKeyToAccount(withPrefix(ownerKey));

const rpc = process.env.RPC_URL || 'https://base-rpc.publicnode.com';
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

const value = parseEther(amount);
const [funderBalance, relayerBalance] = await Promise.all([
  publicClient.getBalance({ address: funder.address }),
  publicClient.getBalance({ address: relayer.address }),
]);

console.log(`from     ${funder.address}   ${formatEther(funderBalance)} ETH`);
console.log(`to       ${relayer.address}   ${formatEther(relayerBalance)} ETH`);
console.log(`sending  ${formatEther(value)} ETH`);

const gasPrice = await publicClient.getGasPrice();
const fee = gasPrice * 21_000n;
console.log(`fee      ~${formatEther(fee)} ETH`);

if (funderBalance < value + fee) {
  console.error('\nFunder cannot cover the transfer plus fee. Stopping.');
  process.exit(1);
}

if (!execute) {
  console.log('\nDry run. Re-run with --execute to send.');
  process.exit(0);
}

const wallet = createWalletClient({ account: funder, chain: base, transport: http(rpc) });
const hash = await wallet.sendTransaction({ to: relayer.address, value });
console.log(`\ntx ${hash}`);

// Once broadcast the transfer is out of our hands, so a flaky receipt poll —
// publicnode answers 403 to some of them — must not read as a failed send.
try {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${receipt.status} in block ${receipt.blockNumber}`);
} catch (error) {
  console.log(`could not read the receipt (${error.shortMessage ?? error.message})`);
  console.log('the transaction was broadcast — check the hash above on basescan');
}

try {
  console.log(
    `\nrelayer now holds ${formatEther(
      await publicClient.getBalance({ address: relayer.address }),
    )} ETH`,
  );
} catch {
  console.log('\ncould not re-read the relayer balance');
}
