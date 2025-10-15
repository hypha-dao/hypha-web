import { NextRequest, NextResponse } from 'next/server';
import {
  getTransfersByAddress,
  getTokenMeta,
  findAllTokens,
} from '@hypha-platform/core/server';
import {
  schemaGetTransfersQuery,
  validTokenTypes,
  TokenType,
} from '@hypha-platform/core/client';
import {
  findPersonByWeb3Address,
  findSpaceByAddress,
} from '@hypha-platform/core/server';
import { findPersonBySlug, getDb } from '@hypha-platform/core/server';
import { zeroAddress } from 'viem';
import { hasEmojiOrLink } from '@hypha-platform/ui-utils';
import { ProfileRouteParams } from '@hypha-platform/epics';

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
  { params }: { params: Promise<ProfileRouteParams> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = decodeURIComponent(personSlugRaw);
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fromDate, toDate, fromBlock, toBlock, limit, token } =
    schemaGetTransfersQuery.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

  try {
    const person = await findPersonBySlug(
      { slug: personSlug },
      { db: getDb({ authToken }) },
    );

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
    const transfers = await getTransfersByAddress({
      address,
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
      address: token.address ?? undefined,
    }));

    const transfersWithEntityInfo = await Promise.all(
      transfers.map(async (transfer) => {
        const tokenMeta = await getTokenMeta(
          transfer.token as `0x${string}`,
          dbTokens,
        );
        const name = tokenMeta.name || 'Unnamed';
        const symbol = tokenMeta.symbol || 'UNKNOWN';
        if (hasEmojiOrLink(name) || hasEmojiOrLink(symbol)) {
          return null;
        }

        const isIncoming = transfer.to.toUpperCase() === address.toUpperCase();
        const counterpartyAddress = isIncoming ? transfer.from : transfer.to;
        let person = null;
        let space = null;
        let tokenIcon = tokenMeta.icon;
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

    console.error('Error while fetching user transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions.' },
      { status: 500 },
    );
  }
}
