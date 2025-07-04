import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import { getSpaceDetails } from '@core/space';
import { publicClient } from '@core/common';
import { getTransfersByAddress } from '@core/server';
import { schemaGetTransfersQuery } from '@core/transaction';
import { findPersonByWeb3Address } from '@core/people/server/queries';
import { db } from '@hypha-platform/storage-postgres';

/**
 * A route to get ERC20 transfers.
 *
 * Query parameters:
 * - token: addresses of token contracts divided by commas. Optional
 * - fromDate: timestamp of the start date from which to get the transfers.
 *   Optional
 * - toDate: timestamp of the end date from which to get the transfers. Optional
 * - fromBlock: the minimum block number from which to get the transfers.
 *   Optional
 * - toBlock: the maximum block number from which to get the transfers.
 *   Optional
 * - limit: the desired number of the result. Not greater than 50.
 *   Defaults to 10
 */
export async function GET(
  { nextUrl }: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  const { fromDate, toDate, fromBlock, toBlock, limit, token } =
    schemaGetTransfersQuery.parse(
      Object.fromEntries(nextUrl.searchParams.entries()),
    );

  try {
    const spaceService = createSpaceService();

    const space = await spaceService.getBySlug({ slug: spaceSlug });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceDetails = await publicClient.readContract(
      getSpaceDetails({ spaceId: BigInt(space.web3SpaceId as number) }),
    );

    const spaceAddress = spaceDetails.at(9) as `0x${string}`;
    const transfers = await getTransfersByAddress({
      address: spaceAddress,
      contractAddresses: token,
      fromDate,
      toDate,
      fromBlock,
      toBlock,
      limit,
    });

    const transfersWithPersonsInfo = await Promise.all(
      transfers.map(async (transfer) => {
        const isIncoming =
          transfer.to.toUpperCase() === spaceAddress.toUpperCase();
        const personAddress = isIncoming ? transfer.from : transfer.to;

        const person = await findPersonByWeb3Address(
          { address: personAddress },
          { db },
        );

        return {
          ...transfer,
          person,
          value: Number(transfer.value) / Math.pow(10, transfer.decimals),
          direction: isIncoming ? 'incoming' : 'outgoing',
          counterparty: isIncoming ? 'from' : 'to',
        };
      }),
    );

    return NextResponse.json(transfersWithPersonsInfo);
  } catch (error: any) {
    const errorMessage =
      error?.message || error?.shortMessage || JSON.stringify(error);
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.warn('Rate limit exceeded calling blockchain:', errorMessage);
      return NextResponse.json(
        {
          error: 'External API rate limit exceeded. Please try again later.',
        },
        { status: 503 },
      );
    }

    console.error('Error while fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions.' },
      { status: 500 },
    );
  }
}
