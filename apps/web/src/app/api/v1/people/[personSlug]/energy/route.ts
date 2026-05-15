import { NextRequest, NextResponse } from 'next/server';
import {
  findPersonBySlug,
  findAllSpacesByWeb3SpaceIds,
  findEnergyCommunityBySpaceId,
  getDb,
  web3Client,
} from '@hypha-platform/core/server';
import { energyPpaV2Abi, getMemberSpaces } from '@hypha-platform/core/client';
import { headers } from 'next/headers';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personSlug: string }> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const appDb = getDb({ authToken });
    const person = await findPersonBySlug({ slug: personSlug }, { db: appDb });
    if (!person?.address) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const memberAddress = person.address as `0x${string}`;
    const memberWeb3SpaceIds = await web3Client.readContract(
      getMemberSpaces({ memberAddress }),
    );

    if (memberWeb3SpaceIds.length === 0) {
      return NextResponse.json({
        enabled: false,
        communities: [],
      });
    }

    const spaces = await findAllSpacesByWeb3SpaceIds(
      {
        web3SpaceIds: memberWeb3SpaceIds.map(Number),
        parentOnly: false,
      },
      { db: appDb },
    );

    const mappings = await Promise.all(
      spaces.map((space) =>
        findEnergyCommunityBySpaceId(space.id, { db: appDb }),
      ),
    );
    const communityMappings = mappings.filter(
      (m): m is NonNullable<typeof m> => m !== null,
    );

    if (communityMappings.length === 0) {
      return NextResponse.json({
        enabled: false,
        communities: [],
      });
    }

    const communityData = await Promise.all(
      communityMappings.map(async (mapping) => {
        const communityProxy = mapping.communityProxyAddress as `0x${string}`;
        const spaceRow = spaces.find((s) => s.id === mapping.spaceId);

        const [
          energyCreditBalance,
          debtInStablecoin,
          creditInStablecoin,
          ownerships,
        ] = await Promise.all([
          web3Client.readContract({
            address: communityProxy,
            abi: energyPpaV2Abi,
            functionName: 'getEnergyCreditBalance',
            args: [memberAddress],
          }),
          web3Client.readContract({
            address: communityProxy,
            abi: energyPpaV2Abi,
            functionName: 'getDebtInStablecoin',
            args: [memberAddress],
          }),
          web3Client.readContract({
            address: communityProxy,
            abi: energyPpaV2Abi,
            functionName: 'getCreditInStablecoin',
            args: [memberAddress],
          }),
          web3Client.readContract({
            address: communityProxy,
            abi: energyPpaV2Abi,
            functionName: 'getAllSourceOwnerships',
            args: [memberAddress],
          }),
        ]);

        const [sourceIds, sourceOwnershipBps] = ownerships;

        return {
          spaceId: mapping.spaceId,
          spaceSlug: spaceRow?.slug ?? null,
          spaceTitle: spaceRow?.title ?? null,
          chainId: mapping.chainId,
          communityProxyAddress: mapping.communityProxyAddress,
          energyTokenAddress: mapping.energyTokenAddress,
          activatedAt: mapping.activatedAt.toISOString(),
          energyCreditBalance: energyCreditBalance.toString(),
          debtInStablecoin: debtInStablecoin.toString(),
          creditInStablecoin: creditInStablecoin.toString(),
          sourceOwnerships: sourceIds.map((sourceId, index) => ({
            sourceId,
            ownershipBps: (sourceOwnershipBps[index] ?? 0n).toString(),
          })),
        };
      }),
    );

    const totals = communityData.reduce(
      (acc, item) => {
        acc.energyCreditBalance += BigInt(item.energyCreditBalance);
        acc.debtInStablecoin += BigInt(item.debtInStablecoin);
        acc.creditInStablecoin += BigInt(item.creditInStablecoin);
        return acc;
      },
      {
        energyCreditBalance: 0n,
        debtInStablecoin: 0n,
        creditInStablecoin: 0n,
      },
    );

    return NextResponse.json({
      enabled: true,
      communities: communityData,
      totals: {
        energyCreditBalance: totals.energyCreditBalance.toString(),
        debtInStablecoin: totals.debtInStablecoin.toString(),
        creditInStablecoin: totals.creditInStablecoin.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch profile energy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile energy data.' },
      { status: 500 },
    );
  }
}
