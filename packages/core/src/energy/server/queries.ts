import { and, eq } from 'drizzle-orm';
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

export const isMissingEnergyCommunitiesTableError = (error: unknown) => {
  const candidate = error as { code?: string; message?: string } | null;
  return (
    candidate?.code === '42P01' &&
    (candidate.message?.includes('energy_communities') ?? false)
  );
};

export const findEnergyCommunityBySpaceId = async (
  spaceId: number,
  { db }: DbConfig,
) => {
  try {
    const [row] = await db
      .select()
      .from(energyCommunities)
      .where(eq(energyCommunities.spaceId, spaceId))
      .limit(1);
    return row ?? null;
  } catch (error) {
    if (isMissingEnergyCommunitiesTableError(error)) {
      console.warn(
        '[energy] energy_communities table is missing; treating activation as unsynced.',
      );
      return null;
    }
    throw error;
  }
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
    .where(eq(energyCommunities.communityProxyAddress, normalized))
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
        eq(energyCommunities.adminAddress, normalized),
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
      communityProxyAddress: input.communityProxyAddress.trim().toLowerCase(),
      energyTokenAddress: input.energyTokenAddress.trim().toLowerCase(),
      adminAddress: input.adminAddress.trim().toLowerCase(),
      factoryCommunityId: input.factoryCommunityId ?? null,
    })
    .onConflictDoUpdate({
      target: energyCommunities.spaceId,
      set: {
        chainId: input.chainId,
        communityProxyAddress: input.communityProxyAddress.trim().toLowerCase(),
        energyTokenAddress: input.energyTokenAddress.trim().toLowerCase(),
        adminAddress: input.adminAddress.trim().toLowerCase(),
        factoryCommunityId: input.factoryCommunityId ?? null,
        activatedAt: input.activatedAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
};
