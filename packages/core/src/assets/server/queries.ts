import { asc, eq, sql, and } from 'drizzle-orm';
import { documents, tokens } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type FindAllTokensProps = {
  search?: string;
};

export const findAllTokens = async (
  { db }: DbConfig,
  { search }: FindAllTokensProps = {},
) => {
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
      documentCount: sql<number>`count(distinct ${documents.id})`.mapWith(
        Number,
      ),
      address: tokens.address,
      agreementWeb3Id: tokens.agreementWeb3Id,
      referenceCurrency: tokens.referenceCurrency,
      referencePrice: tokens.referencePrice,
    })
    .from(tokens)
    .leftJoin(documents, eq(documents.id, tokens.agreementId))
    .where(
      search
        ? sql`(
            -- Full-text search for exact word matches (highest priority)
            (setweight(to_tsvector('english', ${tokens.name}), 'A') ||
             setweight(to_tsvector('english', ${tokens.symbol}), 'B')
            ) @@ plainto_tsquery('english', ${search})
            OR
            -- Partial word matching with ILIKE (case-insensitive)
            ${tokens.name} ILIKE ${'%' + search + '%'}
            OR
            ${tokens.symbol} ILIKE ${'%' + search + '%'}
          )`
        : undefined,
    )
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
      tokens.referenceCurrency,
      tokens.referencePrice,
    )
    .orderBy(asc(tokens.name));

  return results;
};
