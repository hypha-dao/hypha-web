import { NextRequest, NextResponse } from 'next/server';
import {
  getTransfersByAddress,
  getTokenMeta,
  findAllTokens,
  findPeopleByWeb3Addresses,
  findSpaceByAddresses,
  findPersonBySlug,
  getDb,
  findTransfersByTransactionHashes,
} from '@hypha-platform/core/server';
import {
  schemaGetTransfersQuery,
  validTokenTypes,
  TokenType,
  buildKnownTreasuryAddressSet,
  selectVisibleTransfers,
  getEnergyCommunityTokenAddresses,
} from '@hypha-platform/core/client';
import { hasEmojiOrLink, tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { ProfileRouteParams } from '@hypha-platform/epics';

/** Default page when the client omits `limit` (schema max is 50 when set). */
const DEFAULT_PERSON_TRANSFER_LIMIT = 100;

/**
 * A route to get ERC20 transfers for a user.
 *
 * Query parameters:
 * - token: addresses of token contracts divided by commas. Optional
 * - fromDate: timestamp of the start date from which to get the transfers. Optional
 * - toDate: timestamp of the end date from which to get the transfers. Optional
 * - fromBlock: the minimum block number from which to get the transfers. Optional
 * - toBlock: the maximum block number from which to get the transfers. Optional
 * - limit: the desired number of the result. Not greater than 50. When omitted,
 *   the newest {@link DEFAULT_PERSON_TRANSFER_LIMIT} visible transfers are returned
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<ProfileRouteParams> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
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

    // Tokens first so Alchemy can filter/page against the allowlist before
    // metadata. Loading memos for the whole transfers table used to run in
    // parallel with that fetch and could 500 a spam-heavy wallet.
    const rawDbTokens = await findAllTokens(
      { db: getDb({ authToken }) },
      { search: undefined },
    );
    const dbKnownAddresses = buildKnownTreasuryAddressSet(
      rawDbTokens,
      getEnergyCommunityTokenAddresses(),
    );
    const pageLimit = limit ?? DEFAULT_PERSON_TRANSFER_LIMIT;

    const fetchedTransfers = await getTransfersByAddress({
      address,
      contractAddresses: token.length > 0 ? token : undefined,
      fromDate,
      toDate,
      fromBlock,
      toBlock,
      limit: pageLimit,
      knownAddresses: dbKnownAddresses,
    });

    const fromTime = fromDate?.getTime();
    const toTime = toDate?.getTime();
    // Drop spam before `limit` so hidden airdrops do not eat page slots.
    const transfers = selectVisibleTransfers(
      fetchedTransfers
        .filter(
          (transfer) =>
            (fromTime === undefined || transfer.timestamp >= fromTime) &&
            (toTime === undefined || transfer.timestamp <= toTime),
        )
        .sort((a, b) => b.block_number - a.block_number),
      dbKnownAddresses,
      pageLimit,
    );

    const dbTransfers = await findTransfersByTransactionHashes(
      { db: getDb({ authToken }) },
      transfers.map((transfer) => transfer.transaction_hash),
    );

    const memoMap = new Map(
      dbTransfers.map((dbTransfer) => [
        dbTransfer.transactionHash.toLowerCase(),
        dbTransfer.memo,
      ]),
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

    // Resolve token metadata once per unique token. Resolving it per transfer
    // fires one on-chain multicall per transfer, which fails with rate-limit
    // errors on profiles with long transfer histories. Tokens whose metadata
    // can't be resolved (e.g. spam tokens without symbol/name) are skipped
    // instead of failing the whole response.
    const uniqueTokenAddresses = Array.from(
      new Set(transfers.map((transfer) => transfer.token.toLowerCase())),
    );
    const tokenMetaByAddress = new Map<
      string,
      Awaited<ReturnType<typeof getTokenMeta>>
    >();
    await Promise.all(
      uniqueTokenAddresses.map(async (tokenAddress) => {
        try {
          const meta = await getTokenMeta(
            tokenAddress as `0x${string}`,
            dbTokens,
          );
          tokenMetaByAddress.set(tokenAddress, meta);
        } catch (error) {
          console.warn(
            `Skipping token with unresolvable metadata: ${tokenAddress}`,
            error,
          );
        }
      }),
    );

    // Batch-resolve counterparties: one DB query for people and one for
    // spaces, instead of up to two queries per transfer.
    const uniqueCounterparties = Array.from(
      new Set(
        transfers.map((transfer) => {
          const isIncoming =
            transfer.to.toUpperCase() === address.toUpperCase();
          return (isIncoming ? transfer.from : transfer.to).toUpperCase();
        }),
      ),
    );
    const counterpartyPeople = await findPeopleByWeb3Addresses(
      { addresses: uniqueCounterparties },
      { db: getDb({ authToken }) },
    );
    const personByAddress = new Map(
      counterpartyPeople
        .filter((person) => person.address)
        .map((person) => [(person.address as string).toUpperCase(), person]),
    );
    const unmatchedAddresses = uniqueCounterparties.filter(
      (counterparty) => !personByAddress.has(counterparty),
    );
    const counterpartySpaces =
      unmatchedAddresses.length > 0
        ? (
            await findSpaceByAddresses(
              unmatchedAddresses,
              {},
              { db: getDb({ authToken }) },
            )
          ).data
        : [];
    const spaceByAddress = new Map(
      counterpartySpaces
        .filter((space) => space.address)
        .map((space) => [(space.address as string).toUpperCase(), space]),
    );

    const transfersWithEntityInfo = transfers.map((transfer) => {
      const tokenMeta = tokenMetaByAddress.get(transfer.token.toLowerCase());
      if (!tokenMeta) {
        return null;
      }
      const name = tokenMeta.name || 'Unnamed';
      const symbol = tokenMeta.symbol || 'UNKNOWN';
      if (hasEmojiOrLink(name) || hasEmojiOrLink(symbol)) {
        return null;
      }

      const isIncoming = transfer.to.toUpperCase() === address.toUpperCase();
      const counterpartyAddress = (
        isIncoming ? transfer.from : transfer.to
      ).toUpperCase();
      const person = personByAddress.get(counterpartyAddress) ?? null;
      const space = person
        ? null
        : spaceByAddress.get(counterpartyAddress) ?? null;
      const tokenIcon = tokenMeta.icon;

      const memo = memoMap.get(transfer.transaction_hash.toLowerCase()) || null;

      return {
        ...transfer,
        memo,
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
    });

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
