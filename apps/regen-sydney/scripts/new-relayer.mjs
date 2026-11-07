/**
 * Generates the RSUT minting relayer keypair and writes it into .env.
 *
 *   node scripts/new-relayer.mjs
 *
 * The private key is written to the gitignored .env and never printed, so it
 * does not end up in a terminal scrollback or a chat log. Only the address is
 * shown — that is what the token owner authorises with
 * `packages/storage-evm/scripts/rsut-upgrade.mjs --relayer <address>`.
 *
 * Refuses to overwrite an existing key: replacing a relayer that has already
 * been authorised on chain would silently stop minting.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const envPath = new URL('../.env', import.meta.url);

let env = '';
try {
  env = readFileSync(envPath, 'utf8');
} catch {
  console.error('No apps/regen-sydney/.env — copy .env.template to .env first.');
  process.exit(1);
}

const existing = /^RSUT_RELAYER_PRIVATE_KEY=(.*)$/m.exec(env)?.[1]?.trim();
if (existing) {
  const account = privateKeyToAccount(
    existing.startsWith('0x') ? existing : `0x${existing}`,
  );
  console.log('A relayer key is already set in .env.');
  console.log(`  address ${account.address}`);
  console.log('\nClear RSUT_RELAYER_PRIVATE_KEY by hand if you really mean to replace it.');
  process.exit(0);
}

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

const line = `RSUT_RELAYER_PRIVATE_KEY=${privateKey}`;
writeFileSync(
  envPath,
  /^RSUT_RELAYER_PRIVATE_KEY=.*$/m.test(env)
    ? env.replace(/^RSUT_RELAYER_PRIVATE_KEY=.*$/m, line)
    : `${env.replace(/\n*$/, '\n')}${line}\n`,
);

console.log('Relayer created. The key is in apps/regen-sydney/.env, which is gitignored.');
console.log(`\n  address  ${account.address}`);
console.log('\nNext:');
console.log('  1. Fund that address with a little ETH on Base — it pays gas for every mint.');
console.log('  2. Authorise it to mint:');
console.log(`       cd packages/storage-evm`);
console.log(`       node scripts/rsut-upgrade.mjs --relayer ${account.address} --execute`);
console.log('  3. Copy the key into Vercel as RSUT_RELAYER_PRIVATE_KEY for the deployed app.');
