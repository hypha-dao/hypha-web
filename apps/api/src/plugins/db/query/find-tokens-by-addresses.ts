import { sql, inArray } from 'drizzle-orm';
import { schema, tokens } from '../schema';
import type { DbConfig } from './type';

export async function findTokensByAddresses(
  { addresses }: { addresses: `0x${string}`[] },
  { db }: DbConfig<typeof schema>,
) {
  const upperAddresses = addresses.map((addr) => addr.toUpperCase());

  const results = await db
    .select({
      id: tokens.id,
      spaceId: tokens.spaceId,
      agreementId: tokens.agreementId,
      name: tokens.name,
      symbol: tokens.symbol,
      maxSupply: tokens.maxSupply,
      type: tokens.type,
      iconUrl: tokens.iconUrl,
      transferable: tokens.transferable,
      isVotingToken: tokens.isVotingToken,
      decayInterval: tokens.decayInterval,
      decayPercentage: tokens.decayPercentage,
      createdAt: tokens.createdAt,
      address: tokens.address,
      agreementWeb3Id: tokens.agreementWeb3Id,
    })
    .from(tokens)
    .where(inArray(sql<string>`upper(${tokens.address})`, upperAddresses))
    .groupBy(
      tokens.id,
      tokens.spaceId,
      tokens.agreementId,
      tokens.name,
      tokens.symbol,
      tokens.maxSupply,
      tokens.type,
      tokens.iconUrl,
      tokens.transferable,
      tokens.isVotingToken,
      tokens.decayInterval,
      tokens.decayPercentage,
      tokens.createdAt,
      tokens.address,
      tokens.agreementWeb3Id,
    );

  return results;
}
