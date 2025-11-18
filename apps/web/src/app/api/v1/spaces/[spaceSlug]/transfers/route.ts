import { type NextRequest, NextResponse } from 'next/server';
import {
  getSpaceDetails,
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
  findAllTransfers,
  web3Client,
  getDb,
} from '@hypha-platform/core/server';
import { zeroAddress } from 'viem';
import { db } from '@hypha-platform/storage-postgres';
import { hasEmojiOrLink } from '@hypha-platform/ui-utils';

/**
 * @summary Route to get ERC20 transfers of a space
 * @param request Incoming request
 * @param context Request's context with URL params
 *
 * @inner Query parameters
 * @param token Addresses of token contracts divided by commas. Optional
 * @param fromDate Timestamp of the start date from which to get transfers.
 *        Optional
 * @param toDate Timestamp of the end date from which to get transfers. Optional
 * @param fromBlock The minimum block number from which to get transfers.
 *        Optional
 * @param toBlock The maximum block number from which to get transfers. Optional
 * @param limit The desired number of the result. Not greater than 50. Defaults
 *        to 10
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
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceDetails = await web3Client.readContract(
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

    const dbTransfers = await findAllTransfers(
      { db: getDb({ authToken }) },
      {},
    );

    const memoMap = new Map(
      dbTransfers.map((dbTransfer) => [
        dbTransfer.transactionHash.toLowerCase(),
        dbTransfer.memo,
      ]),
    );

    const rawDbTokens = await findAllTokens({ db }, { search: undefined });
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
      address: token.address ?? undefined,
    }));

    const transfersWithEntityInfo = await Promise.all(
      transfers.map(async (transfer) => {
        const isIncoming =
          transfer.to.toUpperCase() === spaceAddress.toUpperCase();
        const direction = isIncoming ? 'incoming' : 'outgoing';
        const counterparty = isIncoming ? 'from' : 'to';

        const meta = await getTokenMeta(
          transfer.token as `0x${string}`,
          dbTokens,
        );
        const name = meta.name || 'Unnamed';
        const symbol = meta.symbol || 'UNKNOWN';
        if (hasEmojiOrLink(name) || hasEmojiOrLink(symbol)) {
          return null;
        }

        const counterpartyAddress = isIncoming ? transfer.from : transfer.to;
        const person =
          (await findPersonByWeb3Address(
            { address: counterpartyAddress },
            { db },
          )) || undefined;
        const space = person
          ? undefined
          : (await findSpaceByAddress(
              { address: counterpartyAddress },
              { db },
            )) || undefined;

        const memo =
          memoMap.get(transfer.transaction_hash.toLowerCase()) || null;

        return {
          ...transfer,
          memo,
          tokenIcon: meta.icon,
          person: person && {
            name: person.name,
            surname: person.surname,
            avatarUrl: person.avatarUrl,
          },
          space: space && {
            title: space.title,
            avatarUrl: space.logoUrl,
          },
          direction,
          counterparty,
        };
      }),
    );

    const validTransfers = transfersWithEntityInfo.filter((t) => t !== null);

    return NextResponse.json(validTransfers);
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
