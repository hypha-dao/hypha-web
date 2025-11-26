import { eq } from 'drizzle-orm';
import { schema, tokens } from '../schema';
import type { DbConfig } from './type';

export async function findTokenById(
  { id }: { id: number },
  { db }: DbConfig<typeof schema>,
) {
  const results = await db
    .select({
      name: tokens.name,
      symbol: tokens.symbol,
      type: tokens.type,
      iconUrl: tokens.iconUrl,
      address: tokens.address,
    })
    .from(tokens)
    .where(eq(tokens.id, id))
    .limit(1);

  return results.at(0);
}
