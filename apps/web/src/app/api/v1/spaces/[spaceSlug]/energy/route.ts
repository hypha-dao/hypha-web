import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  findEnergyCommunityBySpaceId,
  upsertEnergyCommunityActivation,
  web3Client,
  getDb,
  type DatabaseInstance,
} from '@hypha-platform/core/server';
import {
  ENERGY_PPA_CHAIN_ID,
  energyPpaV2Abi,
  energyPpaV2FactoryAbi,
  getEnergyPpaFactoryAddress,
} from '@hypha-platform/core/client';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { headers } from 'next/headers';
import { hexToString } from 'viem';

const SOURCE_TYPES: Record<number, string> = {
  0: 'SOLAR',
  1: 'BATTERY',
};

const toLowerHex = (address: string) => address.toLowerCase() as `0x${string}`;

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
  appDb: DatabaseInstance;
}) {
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
    const communityIds = await web3Client.readContract({
      address: factoryAddress,
      abi: energyPpaV2FactoryAbi,
      functionName: 'getAdminCommunities',
      args: [admin],
    });

    const latestCommunityId = communityIds.at(-1);
    if (latestCommunityId === undefined) continue;

    const communityRecord = await web3Client.readContract({
      address: factoryAddress,
      abi: energyPpaV2FactoryAbi,
      functionName: 'communities',
      args: [latestCommunityId],
    });

    return (
      (await upsertEnergyCommunityActivation(
        {
          spaceId: input.spaceId,
          chainId: Number(chainId),
          communityProxyAddress: communityRecord[0],
          energyTokenAddress: communityRecord[1],
          adminAddress: communityRecord[2],
          factoryCommunityId: Number(latestCommunityId),
          activatedAt: new Date(Number(communityRecord[3]) * 1000),
        },
        { db: input.appDb },
      )) ?? null
    );
  }

  return null;
}

const decodeSourceId = (value: `0x${string}`) => {
  try {
    const parsed = hexToString(value, { size: 32 })
      .replace(/\u0000/g, '')
      .trim();
    return parsed.length > 0 ? parsed : value;
  } catch {
    return value;
  }
};

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
      return NextResponse.json({ enabled: false });
    }

    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return response;
    }

    const headersList = await headers();
    const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
    const appDb = authToken ? getDb({ authToken }) : db;

    let mapping = await findEnergyCommunityBySpaceId(space.id, { db: appDb });

    if (!mapping) {
      mapping = await syncEnergyCommunityFromFactory({
        spaceId: space.id,
        spaceAddress: space.address,
        web3SpaceId: space.web3SpaceId,
        appDb,
      });
    }

    if (!mapping) {
      return NextResponse.json({ enabled: false });
    }

    const communityProxy = toLowerHex(mapping.communityProxyAddress);
    const [
      communityFeeBps,
      aggregatorFeeBps,
      gridBalance,
      settledBalance,
      contractStablecoinBalance,
      zeroSumStatus,
      sourceIds,
      memberAddresses,
      communityRoleAddress,
      aggregatorRoleAddress,
      gridOperatorAddress,
      exportDeviceId,
    ] = await Promise.all([
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getCommunityFeeBps',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getAggregatorFeeBps',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getGridBalance',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getSettledBalance',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getContractStablecoinBalance',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'verifyZeroSum',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getSourceIds',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getMemberAddresses',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getCommunityAddress',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getAggregatorAddress',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getGridOperator',
      }),
      web3Client.readContract({
        address: communityProxy,
        abi: energyPpaV2Abi,
        functionName: 'getExportDeviceId',
      }),
    ]);

    const sourceResults = await Promise.all(
      sourceIds.map((sourceId) =>
        web3Client.readContract({
          address: communityProxy,
          abi: energyPpaV2Abi,
          functionName: 'getSource',
          args: [sourceId],
        }),
      ),
    );

    const sources = sourceResults
      .map((value, index) => {
        const sourceId = sourceIds[index];
        if (!sourceId) {
          return null;
        }
        return {
          sourceId,
          sourceLabel: decodeSourceId(sourceId),
          sourceType: SOURCE_TYPES[Number(value[0])] ?? 'UNKNOWN',
          ownershipToken: value[1],
          basePricePerKwh: value[2].toString(),
          active: value[3],
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return NextResponse.json({
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
      overview: {
        memberCount: memberAddresses.length,
        sourceCount: sourceIds.length,
        communityFeeBps: Number(communityFeeBps),
        aggregatorFeeBps: Number(aggregatorFeeBps),
        gridBalance: gridBalance.toString(),
        settledBalance: settledBalance.toString(),
        contractStablecoinBalance: contractStablecoinBalance.toString(),
        zeroSumOk: zeroSumStatus[0],
        zeroSumDelta: zeroSumStatus[1].toString(),
      },
      roles: {
        communityAddress: communityRoleAddress.toLowerCase() as `0x${string}`,
        aggregatorAddress: aggregatorRoleAddress.toLowerCase() as `0x${string}`,
        gridOperator: gridOperatorAddress.toLowerCase() as `0x${string}`,
        exportDeviceId: exportDeviceId.toString(),
      },
      members: memberAddresses.map((a) => a.toLowerCase() as `0x${string}`),
      sources,
    });
  } catch (error) {
    console.error('Failed to fetch space energy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space energy data.' },
      { status: 500 },
    );
  }
}
