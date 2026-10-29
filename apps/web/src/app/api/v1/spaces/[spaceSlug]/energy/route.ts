import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  findEnergyCommunityBySpaceId,
  isMissingEnergyCommunitiesTableError,
  upsertEnergyCommunityActivation,
  web3Client,
  resolveEnergyParticipants,
  institutionalLabelsForSpace,
  readEnergyCommunitySnapshot,
  rememberEnergyCommunityMemberAddresses,
  type DatabaseInstance,
} from '@hypha-platform/core/server';
import {
  ENERGY_PPA_CHAIN_ID,
  energyPpaV2FactoryAbi,
  getEnergyPpaFactoryAddress,
} from '@hypha-platform/core/client';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type EnergyCommunityActivation = {
  spaceId: number;
  chainId: number;
  communityProxyAddress: string;
  energyTokenAddress: string;
  adminAddress: string;
  factoryCommunityId: number | null;
  activatedAt: Date;
};

const ENERGY_RESPONSE_CACHE_CONTROL =
  'private, max-age=15, stale-while-revalidate=30';

/**
 * Hypha links a space to `EnergyPPAv2Factory.adminCommunities[admin]`.
 * The Enable Energy Community proposal sets `admin` to an arbitrary address;
 * it is often the **space executor** (smart account) rather than `spaces.address`
 * (space contract). Try space wallet first, then fall back to `getSpaceExecutor`.
 */
async function syncEnergyCommunityFromFactory(input: {
  spaceId: number;
  spaceAddress: string | null;
  web3SpaceId: number | null;
  /** Server pool (`db`); avoids Neon JWT `authenticated` lacking sequence grants on `energy_communities`. */
  persistDb: DatabaseInstance;
}): Promise<EnergyCommunityActivation | null> {
  const factoryAddress = getEnergyPpaFactoryAddress();
  const chainId = ENERGY_PPA_CHAIN_ID;
  const adminCandidates: `0x${string}`[] = [];
  const seen = new Set<string>();

  const pushAdmin = (raw: string | null | undefined) => {
    if (!raw || typeof raw !== 'string') return;
    const t = raw.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    adminCandidates.push(t as `0x${string}`);
  };

  pushAdmin(input.spaceAddress ?? undefined);

  const spaceFactoryAddr =
    daoSpaceFactoryImplementationAddress[
      chainId as keyof typeof daoSpaceFactoryImplementationAddress
    ];
  if (input.web3SpaceId != null && spaceFactoryAddr) {
    try {
      const executor = await web3Client.readContract({
        address: spaceFactoryAddr as `0x${string}`,
        abi: daoSpaceFactoryImplementationAbi,
        functionName: 'getSpaceExecutor',
        args: [BigInt(input.web3SpaceId)],
      });
      pushAdmin(executor as string);
    } catch (e) {
      console.warn('[spaces/energy] getSpaceExecutor failed', e);
    }
  }

  for (const admin of adminCandidates) {
    let communityIds: readonly bigint[];
    try {
      communityIds = await web3Client.readContract({
        address: factoryAddress,
        abi: energyPpaV2FactoryAbi,
        functionName: 'getAdminCommunities',
        args: [admin],
      });
    } catch (e) {
      console.warn(
        `[spaces/energy] getAdminCommunities failed for admin ${admin}`,
        e,
      );
      continue;
    }

    const latestCommunityId = communityIds.at(-1);
    if (latestCommunityId === undefined) continue;

    let communityRecord: readonly [
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      bigint,
    ];
    try {
      communityRecord = (await web3Client.readContract({
        address: factoryAddress,
        abi: energyPpaV2FactoryAbi,
        functionName: 'communities',
        args: [latestCommunityId],
      })) as typeof communityRecord;
    } catch (e) {
      console.warn(
        `[spaces/energy] communities(${latestCommunityId}) read failed`,
        e,
      );
      continue;
    }

    const activation: EnergyCommunityActivation = {
      spaceId: input.spaceId,
      chainId: Number(chainId),
      communityProxyAddress: communityRecord[0],
      energyTokenAddress: communityRecord[1],
      adminAddress: communityRecord[2],
      factoryCommunityId: Number(latestCommunityId),
      activatedAt: new Date(Number(communityRecord[3]) * 1000),
    };

    try {
      return (
        (await upsertEnergyCommunityActivation(activation, {
          db: input.persistDb,
        })) ?? activation
      );
    } catch (e) {
      if (isMissingEnergyCommunitiesTableError(e)) {
        console.warn(
          '[spaces/energy] energy_communities table is missing; returning on-chain activation without persistence.',
        );
        return activation;
      }
      console.warn('[spaces/energy] upsertEnergyCommunityActivation failed', e);
      return null;
    }
  }

  return null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': ENERGY_RESPONSE_CACHE_CONTROL },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId == null) {
      return json({ enabled: false });
    }

    /**
     * Gate access via the standard transparency-matrix check, BUT never let a
     * transient RPC failure inside `checkSpaceAccess` (it calls
     * `publicClient.readContract(getSpaceVisibility(...))` against a public
     * Base RPC that throttles aggressively) turn into a 500 here. Everything
     * we eventually return (community proxy, members, sources, fees…) is
     * already public on-chain data readable by anyone via Basescan, so on
     * verifier infrastructure failure we fall through and treat the request
     * as anonymous-public rather than serving a misleading 500.
     */
    const access = await checkSpaceAccess(request, space.web3SpaceId as number);
    if (!access.hasAccess && access.response) {
      const status = access.response.status;
      if (status === 401 || status === 403) {
        return access.response;
      }
      console.warn(
        `[spaces/energy] checkSpaceAccess returned ${status} — falling through (public on-chain data).`,
      );
    }

    let mapping: EnergyCommunityActivation | null =
      await findEnergyCommunityBySpaceId(space.id, { db });

    if (!mapping) {
      try {
        mapping = await syncEnergyCommunityFromFactory({
          spaceId: space.id,
          spaceAddress: space.address ?? null,
          web3SpaceId: space.web3SpaceId,
          persistDb: db,
        });
      } catch (e) {
        // Never let factory sync turn into a 500 — the UI just renders
        // "energy not enabled yet" when this path fails.
        console.warn('[spaces/energy] syncEnergyCommunityFromFactory threw', e);
        mapping = null;
      }
    }

    if (!mapping) {
      return json({ enabled: false });
    }

    const snapshot = await readEnergyCommunitySnapshot(
      mapping.communityProxyAddress,
    );
    rememberEnergyCommunityMemberAddresses(spaceSlug, snapshot.memberAddresses);

    const memberDeviceIds = new Map<string, number[] | null>();
    for (const detail of snapshot.memberDetails) {
      memberDeviceIds.set(detail.address.toLowerCase(), detail.deviceIds);
    }

    const participantProfiles = await resolveEnergyParticipants(
      {
        addresses: snapshot.memberAddresses,
        spaceSlug,
        memberDeviceIds,
        institutionalByDevice: institutionalLabelsForSpace(spaceSlug),
      },
      { db },
    );

    return json({
      enabled: true,
      activation: {
        spaceId: mapping.spaceId,
        chainId: mapping.chainId,
        communityProxyAddress: mapping.communityProxyAddress,
        energyTokenAddress: mapping.energyTokenAddress,
        adminAddress: mapping.adminAddress,
        factoryCommunityId: mapping.factoryCommunityId,
        activatedAt: mapping.activatedAt.toISOString(),
      },
      overview: snapshot.overview,
      roles: snapshot.roles,
      members: snapshot.memberAddresses,
      memberDetails: snapshot.memberDetails,
      participantProfiles,
      sources: snapshot.sources,
      optimization: snapshot.optimization,
    });
  } catch (error) {
    console.error('Failed to fetch space energy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space energy data.' },
      { status: 500 },
    );
  }
}
