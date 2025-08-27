import { type NextRequest, NextResponse } from 'next/server';
import {
  getSpaceDetails,
  publicClient,
  schemaGetTransfersQuery,
  validTokenTypes,
  type TokenType,
} from '@hypha-platform/core/client';
import {
  findSpaceBySlug,
  getTransfersByAddress,
  findSpaceByAddress,
  getTokenMeta,
  findPersonByWeb3Address,
  findAllTokens,
  getDb,
} from '@hypha-platform/core/server';
import { zeroAddress } from 'viem';

/**
 * A route to get ERC20 transfers.
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
  { nextUrl, headers }: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const authToken = headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fromDate, toDate, fromBlock, toBlock, limit, token } =
    schemaGetTransfersQuery.parse(
      Object.fromEntries(nextUrl.searchParams.entries()),
    );

  try {
    const space = await findSpaceBySlug(
      { slug: spaceSlug },
      { db: getDb({ authToken }) },
    );
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

    const rawDbTokens = await findAllTokens(
      { db: getDb({ authToken }) },
      { search: undefined },
    );
    const dbTokens = rawDbTokens.map((token) => ({
      agreementId: token.agreementId ?? undefined,
      spaceId: token.spaceId ?? undefined,
      name: token.name,
      symbol: token.symbol,
      maxSupply: token.maxSupply,
      type: validTokenTypes.includes(token.type as TokenType)
        ? (token.type as TokenType)
        : 'utility',
      iconUrl: token.iconUrl ?? undefined,
      transferable: token.transferable,
      isVotingToken: token.isVotingToken,
    }));

    const transfersWithEntityInfo = await Promise.all(
      transfers.map(async (transfer) => {
        const isIncoming =
          transfer.to.toUpperCase() === spaceAddress.toUpperCase();
        const counterpartyAddress = isIncoming ? transfer.from : transfer.to;
        const isMint = transfer.from === zeroAddress;

        let person = null;
        let space = null;
        let tokenIcon = null;
        if (isMint) {
          const tokenMeta = await getTokenMeta(
            transfer.token as `0x${string}`,
            dbTokens,
          );
          tokenIcon = tokenMeta.icon;
        } else {
          person = await findPersonByWeb3Address(
            { address: counterpartyAddress },
            { db: getDb({ authToken }) },
          );
          if (!person) {
            space = await findSpaceByAddress(
              { address: counterpartyAddress },
              { db: getDb({ authToken }) },
            );
          }
        }

        return {
          ...transfer,
          person: person
            ? {
                name: person.name,
                surname: person.surname,
                avatarUrl: person.avatarUrl,
              }
            : undefined,
          space: space
            ? {
                title: space.title,
                avatarUrl: space.logoUrl,
              }
            : undefined,
          tokenIcon,
          direction: isIncoming ? 'incoming' : 'outgoing',
          counterparty: isIncoming ? 'from' : 'to',
        };
      }),
    );

    return NextResponse.json(transfersWithEntityInfo);
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
