import { NextRequest, NextResponse } from 'next/server';
import { createPeopleService } from '@hypha-platform/core/server';
import { getTransfersByAddress } from '@core/server';
import { schemaGetTransfersQuery } from '@core/transaction';
import { findPersonByWeb3Address } from '@core/people/server/queries';
import { db } from '@hypha-platform/storage-postgres';

/**
 * A route to get ERC20 transfers for a user.
 *
 * Query parameters:
 * - token: addresses of token contracts divided by commas. Optional
 * - fromDate: timestamp of the start date from which to get the transfers. Optional
 * - toDate: timestamp of the end date from which to get the transfers. Optional
 * - fromBlock: the minimum block number from which to get the transfers. Optional
 * - toBlock: the maximum block number from which to get the transfers. Optional
 * - limit: the desired number of the result. Not greater than 50. Defaults to 10
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personSlug: string }> },
) {
  const { personSlug } = await params;
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  const { fromDate, toDate, fromBlock, toBlock, limit, token } =
    schemaGetTransfersQuery.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

  try {
    const peopleService = createPeopleService({ authToken });
    const person = await peopleService.findBySlug({ slug: personSlug });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const address = person.address as `0x${string}`;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid or missing address' },
        { status: 400 },
      );
    }
    console.log('address', address);
    const transfers = await getTransfersByAddress({
      address,
      contractAddresses: token,
      fromDate,
      toDate,
      fromBlock,
      toBlock,
      limit,
    });

    const transfersWithPersonsInfo = await Promise.all(
      transfers.map(async (transfer) => {
        const isIncoming = transfer.to.toUpperCase() === address.toUpperCase();
        const counterpartyAddress = isIncoming ? transfer.from : transfer.to;

        const counterpartyPerson = await findPersonByWeb3Address(
          { address: counterpartyAddress },
          { db },
        );

        return {
          ...transfer,
          person: counterpartyPerson,
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

    console.error('Error while fetching user transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions.' },
      { status: 500 },
    );
  }
}
