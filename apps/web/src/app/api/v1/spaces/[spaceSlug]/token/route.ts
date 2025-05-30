import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import { getSpaceDetails } from '@core/space';
import { publicClient } from '@core/common';
import { ERC20 } from './_abis';

// TODO: move to constants
const tradableTokens: `0x${string}`[] = [
  // EURC
  "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42",
  // USDC
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  // WBTC
  "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
];

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    const spaceService = createSpaceService();

    const space = await spaceService.getBySlug({ slug: spaceSlug });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    let spaceDetails;
    try {
      spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId: BigInt(space.web3SpaceId as number) }),
      );
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.shortMessage || JSON.stringify(err);
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        console.warn(
          'Rate limit exceeded when calling readContract:',
          errorMessage,
        );
        return NextResponse.json(
          {
            error: 'External API rate limit exceeded. Please try again later.',
          },
          { status: 503 },
        );
      }

      console.error('Error while calling readContract:', err);
      return NextResponse.json(
        { error: 'Failed to fetch contract data.' },
        { status: 500 },
      );
    }

    const [
      /*unity*/,
      /*quorum*/,
      /*votingPowerSource*/,
      tokenAdresses,
      /*members*/,
      /*exitMethod*/,
      /*joinMethod*/,
      /*createdAt*/,
      /*creator*/,
      spaceAddress,
    ] = spaceDetails;

    const params = tradableTokens.concat(tokenAdresses).map(address => {
      return [
        balanceOfParams(address, spaceAddress),
        symbolParams(address),
        decimalsParams(address),
      ];
    });
    const result = await Promise.all(params.map(param => {
      return publicClient.multicall({
        contracts: param,
      })
    }));

    // TODO: serialize BigInt
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}

const balanceOfParams = (
  token: `0x${string}`,
  owner: `0x${string}`,
) => {
  return {
    address: token,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [owner],
  } as const
};

const symbolParams = (
  token: `0x${string}`,
) => {
  return {
    address: token,
    abi: ERC20,
    functionName: 'symbol',
    args: [],
  } as const
}

const decimalsParams = (
  token: `0x${string}`,
) => {
  return {
    address: token,
    abi: ERC20,
    functionName: 'decimals',
    args: [],
  } as const
}

