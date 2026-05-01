import { and, eq, sql } from 'drizzle-orm';
import { energyCommunities, spaces } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type UpsertEnergyCommunityActivationInput = {
  spaceId: number;
  chainId: number;
  communityProxyAddress: string;
  energyTokenAddress: string;
  adminAddress: string;
  factoryCommunityId?: number | null;
  activatedAt: Date;
};

export const findEnergyCommunityBySpaceId = async (
  spaceId: number,
  { db }: DbConfig,
) => {
  const [row] = await db
    .select()
    .from(energyCommunities)
    .where(eq(energyCommunities.spaceId, spaceId))
    .limit(1);
  return row ?? null;
};

export const findEnergyCommunityBySpaceSlug = async (
  spaceSlug: string,
  { db }: DbConfig,
) => {
  const [row] = await db
    .select({
      energyCommunity: energyCommunities,
      space: spaces,
    })
    .from(energyCommunities)
    .innerJoin(spaces, eq(energyCommunities.spaceId, spaces.id))
    .where(eq(spaces.slug, spaceSlug))
    .limit(1);
  return row ?? null;
};

export const findEnergyCommunityByProxyAddress = async (
  communityProxyAddress: string,
  { db }: DbConfig,
) => {
  const normalized = communityProxyAddress.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(energyCommunities)
    .where(
      sql`lower(${energyCommunities.communityProxyAddress}) = ${normalized}`,
    )
    .limit(1);
  return row ?? null;
};

export const findEnergyCommunityByAdminAndSpaceId = async (
  adminAddress: string,
  spaceId: number,
  { db }: DbConfig,
) => {
  const normalized = adminAddress.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(energyCommunities)
    .where(
      and(
        eq(energyCommunities.spaceId, spaceId),
        sql`lower(${energyCommunities.adminAddress}) = ${normalized}`,
      ),
    )
    .limit(1);
  return row ?? null;
};

export const upsertEnergyCommunityActivation = async (
  input: UpsertEnergyCommunityActivationInput,
  { db }: DbConfig,
) => {
  const [row] = await db
    .insert(energyCommunities)
    .values({
      ...input,
      communityProxyAddress: input.communityProxyAddress.toLowerCase(),
      energyTokenAddress: input.energyTokenAddress.toLowerCase(),
      adminAddress: input.adminAddress.toLowerCase(),
      factoryCommunityId: input.factoryCommunityId ?? null,
    })
    .onConflictDoUpdate({
      target: energyCommunities.spaceId,
      set: {
        chainId: input.chainId,
        communityProxyAddress: input.communityProxyAddress.toLowerCase(),
        energyTokenAddress: input.energyTokenAddress.toLowerCase(),
        adminAddress: input.adminAddress.toLowerCase(),
        factoryCommunityId: input.factoryCommunityId ?? null,
        activatedAt: input.activatedAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
};
