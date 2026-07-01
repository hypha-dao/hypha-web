/**
 * Remove undeployed draft token rows left behind by failed issue-token proposals.
 *
 * Usage (dry run — lists rows only):
 *   SPACE_SLUG=bioregion-saintonge TOKEN_SYMBOL=LIT pnpm exec tsx scripts/cleanup-undeployed-space-tokens.ts
 *
 * Usage (delete):
 *   SPACE_SLUG=bioregion-saintonge TOKEN_SYMBOL=LIT pnpm exec tsx scripts/cleanup-undeployed-space-tokens.ts --confirm
 *
 * Requires BRANCH_DB_URL or DEFAULT_DB_URL (same as the app DB).
 */
import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../src/db';
import { spaces, tokens } from '../src/schema';

const spaceSlug = process.env.SPACE_SLUG?.trim();
const tokenSymbol = process.env.TOKEN_SYMBOL?.trim();
const confirm = process.argv.includes('--confirm');

async function main() {
  if (!spaceSlug) {
    throw new Error('SPACE_SLUG is required (e.g. bioregion-saintonge)');
  }

  const [space] = await db
    .select({ id: spaces.id, slug: spaces.slug, title: spaces.title })
    .from(spaces)
    .where(eq(spaces.slug, spaceSlug))
    .limit(1);

  if (!space) {
    throw new Error(`Space not found for slug: ${spaceSlug}`);
  }

  const conditions = [eq(tokens.spaceId, space.id), isNull(tokens.address)];
  if (tokenSymbol) {
    conditions.push(sql`lower(${tokens.symbol}) = lower(${tokenSymbol})`);
  }

  const matches = await db
    .select({
      id: tokens.id,
      name: tokens.name,
      symbol: tokens.symbol,
      agreementId: tokens.agreementId,
      agreementWeb3Id: tokens.agreementWeb3Id,
      createdAt: tokens.createdAt,
    })
    .from(tokens)
    .where(and(...conditions));

  console.log(
    JSON.stringify(
      {
        space: { id: space.id, slug: space.slug, title: space.title },
        tokenSymbolFilter: tokenSymbol ?? null,
        matchCount: matches.length,
        matches,
        confirm,
      },
      null,
      2,
    ),
  );

  if (matches.length === 0) {
    return;
  }

  if (!confirm) {
    console.log(
      '\nDry run only. Re-run with --confirm to delete these undeployed draft rows.',
    );
    return;
  }

  const deleted = await db
    .delete(tokens)
    .where(and(...conditions))
    .returning({
      id: tokens.id,
      name: tokens.name,
      symbol: tokens.symbol,
      agreementWeb3Id: tokens.agreementWeb3Id,
    });

  console.log('\nDeleted:', JSON.stringify(deleted, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
