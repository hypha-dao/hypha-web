/**
 * One-off, idempotent fix for the "LIT" (Local Impact Token) in space
 * "Biorégion du Grand Paris" (web3SpaceId 1105).
 *
 * Context: the token WAS deployed on-chain (RegularTokenFactory) at
 *   0x472320f5f22C133349d60373DeF05d8acA0cF827
 * (verified on Base mainnet: getSpaceToken(1105) returns it, symbol() = "LIT",
 *  name() = "Local Impact Token", totalSupply = 0).
 * But its Postgres `tokens.address` was never written back (the address link is
 * normally done client-side by the open proposal page at execution time), so the
 * Treasury card renders "bare" (no type badge / created date / space / icon).
 *
 * This script backfills `tokens.address` for that row. It is SAFE:
 *   - dry-run by default (prints what it would do); pass --apply to write.
 *   - only updates rows whose address IS NULL and symbol matches.
 *   - refuses to act if the target address is already linked to another row.
 *
 * Usage (read-only inspection):
 *   DEFAULT_DB_URL=postgres://... node scripts/fix-lit-token-address.mjs
 * Apply:
 *   DEFAULT_DB_URL=postgres://... node scripts/fix-lit-token-address.mjs --apply
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { WebSocket } from 'ws';

const WEB3_SPACE_ID = Number(process.env.WEB3_SPACE_ID || 1105);
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || 'LIT';
const TOKEN_ADDRESS =
  process.env.TOKEN_ADDRESS || '0x472320f5f22C133349d60373DeF05d8acA0cF827';
const APPLY = process.argv.includes('--apply');

const connectionString =
  process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL;

if (!connectionString) {
  console.error(
    'Missing DB connection string. Set BRANCH_DB_URL or DEFAULT_DB_URL.',
  );
  process.exit(1);
}

if (connectionString.includes('localhost')) {
  neonConfig.wsProxy = (host) => `${host}:5433/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
} else {
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.poolQueryViaFetch = true;
}

const pool = new Pool({ connectionString });

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (read-only)'}`);
  console.log(
    `Target: web3SpaceId=${WEB3_SPACE_ID} symbol=${TOKEN_SYMBOL} address=${TOKEN_ADDRESS}\n`,
  );

  const { rows: spaces } = await pool.query(
    `SELECT id, slug, title, web3_space_id FROM spaces WHERE web3_space_id = $1`,
    [WEB3_SPACE_ID],
  );
  if (spaces.length === 0) {
    console.error(`No space found with web3_space_id = ${WEB3_SPACE_ID}.`);
    return;
  }
  const space = spaces[0];
  console.log(
    `Space: id=${space.id} slug="${space.slug}" title="${space.title}"`,
  );

  // Show all tokens in this space for context.
  const { rows: spaceTokens } = await pool.query(
    `SELECT id, name, symbol, address, type, agreement_id, agreement_web3_id, created_at
       FROM tokens WHERE space_id = $1 ORDER BY id`,
    [space.id],
  );
  console.log(`\nTokens in space ${space.id}:`);
  for (const t of spaceTokens) {
    console.log(
      `  #${t.id} ${t.symbol} "${t.name}" type=${t.type} address=${
        t.address ?? 'NULL'
      } agreementWeb3Id=${t.agreement_web3_id ?? 'NULL'} created=${t.created_at}`,
    );
  }

  // Guard: is the target address already linked anywhere?
  const { rows: existingByAddr } = await pool.query(
    `SELECT id, symbol, space_id FROM tokens WHERE lower(address) = lower($1)`,
    [TOKEN_ADDRESS],
  );
  if (existingByAddr.length > 0) {
    console.log(
      `\nAddress ${TOKEN_ADDRESS} is already linked to token(s): ${existingByAddr
        .map((r) => `#${r.id}(${r.symbol})`)
        .join(', ')}. Nothing to do.`,
    );
    return;
  }

  // Find the LIT row to fix.
  const candidates = spaceTokens.filter(
    (t) => (t.symbol || '').toUpperCase() === TOKEN_SYMBOL.toUpperCase(),
  );
  if (candidates.length === 0) {
    console.log(
      `\nNo DB token row found for symbol ${TOKEN_SYMBOL} in space ${space.id}. ` +
        `A row may need to be created instead of updated — stopping (no insert performed).`,
    );
    return;
  }
  const nullAddr = candidates.filter((t) => t.address == null);
  if (nullAddr.length === 0) {
    console.log(
      `\n${TOKEN_SYMBOL} row(s) already have an address set. Nothing to do.`,
    );
    return;
  }
  if (nullAddr.length > 1) {
    console.log(
      `\nFound ${nullAddr.length} ${TOKEN_SYMBOL} rows with NULL address ` +
        `(ids: ${nullAddr.map((t) => t.id).join(', ')}). Refusing ambiguous update.`,
    );
    return;
  }

  const target = nullAddr[0];
  console.log(
    `\nWill set tokens.address = ${TOKEN_ADDRESS} on token #${target.id} (${target.symbol} "${target.name}").`,
  );

  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to write.');
    return;
  }

  const { rows: updated } = await pool.query(
    `UPDATE tokens SET address = $1
       WHERE id = $2 AND address IS NULL
       RETURNING id, symbol, address`,
    [TOKEN_ADDRESS, target.id],
  );
  if (updated.length === 0) {
    console.log('No row updated (address was set concurrently?).');
  } else {
    console.log(
      `Updated token #${updated[0].id} (${updated[0].symbol}) -> address=${updated[0].address}`,
    );
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await pool.end().catch(() => {});
    process.exit(1);
  });
