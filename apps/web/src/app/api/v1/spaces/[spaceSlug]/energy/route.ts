import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  findEnergyCommunityBySpaceId,
  upsertEnergyCommunityActivation,
  web3Client,
  getDb,
} from '@hypha-platform/core/server';
import {
  energyPpaV2Abi,
  energyPpaV2FactoryAbi,
  getEnergyPpaFactoryAddress,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { headers } from 'next/headers';
import { hexToString } from 'viem';

const SOURCE_TYPES: Record<number, string> = {
  0: 'SOLAR',
  1: 'BATTERY',
};

const toLowerHex = (address: string) => address.toLowerCase() as `0x${string}`;

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

    if (!mapping && space.address) {
      const factoryAddress = getEnergyPpaFactoryAddress();
      if (factoryAddress) {
        const communityIds = await web3Client.readContract({
          address: factoryAddress,
          abi: energyPpaV2FactoryAbi,
          functionName: 'getAdminCommunities',
          args: [toLowerHex(space.address)],
        });

        const latestCommunityId = communityIds.at(-1);
        if (latestCommunityId !== undefined) {
          const communityRecord = await web3Client.readContract({
            address: factoryAddress,
            abi: energyPpaV2FactoryAbi,
            functionName: 'communities',
            args: [latestCommunityId],
          });

          mapping = await upsertEnergyCommunityActivation(
            {
              spaceId: space.id,
              chainId: 8453,
              communityProxyAddress: communityRecord[0],
              energyTokenAddress: communityRecord[1],
              adminAddress: communityRecord[2],
              factoryCommunityId: Number(latestCommunityId),
              activatedAt: new Date(Number(communityRecord[3]) * 1000),
            },
            { db: appDb },
          );
        }
      }
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
    ]);

    const sourceCalls = sourceIds.map((sourceId) => ({
      address: communityProxy,
      abi: energyPpaV2Abi,
      functionName: 'getSource',
      args: [sourceId],
    })) as const;

    const sourceResults =
      sourceCalls.length > 0
        ? await web3Client.multicall({ contracts: sourceCalls })
        : [];

    const sources = sourceResults
      .map((result, index) => {
        if (result.status !== 'success') {
          return null;
        }
        const sourceId = sourceIds[index];
        const value = result.result;
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
