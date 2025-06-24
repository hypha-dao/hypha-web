import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import { getSpaceDetails } from '@core/space';
import { publicClient } from '@core/common';
import { getMoralis } from '@core/common/web3';
import { schemaGetTransfersQuery } from '@core/transaction';

/**
 * A route to get ERC20 transfers.
 *
 * Query parameters:
 * - token: addresses of token contracts divided by commas. Optional
 * - fromDate: timestamp of the start date from which to get the transfers.
 *   Optional
 * - toDate: timestamp of the start date from which to get the transfers. Optional
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

  const { fromDate, toDate, limit, fromBlock, toBlock, token } =
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

    const moralisClient = await getMoralis();
    const transactions =
      await moralisClient.EvmApi.token.getWalletTokenTransfers({
        contractAddresses: token,
        address: spaceAddress,
        fromDate: fromDate,
        toDate: toDate,
        fromBlock,
        toBlock,
        limit,
      });

    const result = transactions.toJSON().result.map((trx) => {
      return {
        from: trx.from_address,
        to: trx.to_address,
        value: trx.value,
        symbol: trx.token_symbol,
        decimals: +trx.token_decimals,
        token: trx.address,
        timestamp: Date.parse(trx.block_timestamp),
        block_number: +trx.block_number,
        transaction_index: trx.transaction_index,
        transaction_hash: trx.transaction_hash,
      };
    });
    return NextResponse.json(result);
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
