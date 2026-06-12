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
  getMintTransfersByTokens,
  findSpaceByAddresses,
  getTokenMeta,
  findPeopleByWeb3Addresses,
  findAllTokens,
  findAllTransfers,
  web3Client,
  getDb,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt, hasEmojiOrLink } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

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
 * @param limit The desired number of the result. Not greater than 50. When
 *        omitted, all available transfers are returned
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const { nextUrl, headers } = request;

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
    if (!space || !canConvertToBigInt(space.web3SpaceId)) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );

    if (!hasAccess && response) {
      return response;
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

    // Mints emit Transfer(0x0 -> recipient) and never reference the space
    // address, so the address-based query above misses tokens the space
    // minted to other accounts (e.g. airdrops to members). Query mints of
    // the space's own token contracts and merge them in.
    const requestedTokens =
      token && token.length > 0
        ? token.map((address) => address.toLowerCase())
        : undefined;
    const spaceTokenAddresses = rawDbTokens
      .filter(
        (dbToken) =>
          dbToken.spaceId === space.id &&
          dbToken.address &&
          (!requestedTokens ||
            requestedTokens.includes(dbToken.address.toLowerCase())),
      )
      .map((dbToken) => dbToken.address as string);

    const mintTransfers = (
      await getMintTransfersByTokens({
        contractAddresses: spaceTokenAddresses,
        fromBlock,
        toBlock,
        limit,
      })
    ).filter(
      // Mints to the space itself are already returned by the address-based
      // query; keep only mints to other accounts to avoid duplicates.
      (mint) => mint.to.toLowerCase() !== spaceAddress.toLowerCase(),
    );

    // Apply the date window to the merged set before slicing: the mint branch
    // only filters by block range, so date-only requests would otherwise leak
    // out-of-range mints into the response.
    const fromTime = fromDate?.getTime();
    const toTime = toDate?.getTime();

    // Enforce the limit on the merged set only when the caller requested one;
    // `slice(0, undefined)` keeps the full history.
    const allTransfers = [...transfers, ...mintTransfers]
      .filter(
        (transfer) =>
          (fromTime === undefined || transfer.timestamp >= fromTime) &&
          (toTime === undefined || transfer.timestamp <= toTime),
      )
      .sort((a, b) => b.block_number - a.block_number)
      .slice(0, limit);

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
    // errors on spaces with long transfer histories. Tokens whose metadata
    // can't be resolved (e.g. spam tokens without symbol/name) are skipped
    // instead of failing the whole response.
    const uniqueTokenAddresses = Array.from(
      new Set(allTransfers.map((transfer) => transfer.token.toLowerCase())),
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
        allTransfers.map((transfer) => {
          const isIncoming =
            transfer.to.toUpperCase() === spaceAddress.toUpperCase();
          return (isIncoming ? transfer.from : transfer.to).toUpperCase();
        }),
      ),
    );
    const counterpartyPeople = await findPeopleByWeb3Addresses(
      { addresses: uniqueCounterparties },
      { db },
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
        ? (await findSpaceByAddresses(unmatchedAddresses, {}, { db })).data
        : [];
    const spaceByAddress = new Map(
      counterpartySpaces
        .filter((counterpartySpace) => counterpartySpace.address)
        .map((counterpartySpace) => [
          (counterpartySpace.address as string).toUpperCase(),
          counterpartySpace,
        ]),
    );

    const transfersWithEntityInfo = allTransfers.map((transfer) => {
      const isIncoming =
        transfer.to.toUpperCase() === spaceAddress.toUpperCase();
      const direction = isIncoming ? 'incoming' : 'outgoing';
      const counterparty = isIncoming ? 'from' : 'to';

      const meta = tokenMetaByAddress.get(transfer.token.toLowerCase());
      if (!meta) {
        return null;
      }
      const name = meta.name || 'Unnamed';
      const symbol = meta.symbol || 'UNKNOWN';
      if (hasEmojiOrLink(name) || hasEmojiOrLink(symbol)) {
        return null;
      }

      const counterpartyAddress = (
        isIncoming ? transfer.from : transfer.to
      ).toUpperCase();
      const person = personByAddress.get(counterpartyAddress);
      const counterpartySpace = person
        ? undefined
        : spaceByAddress.get(counterpartyAddress);

      const memo = memoMap.get(transfer.transaction_hash.toLowerCase()) || null;

      return {
        ...transfer,
        memo,
        tokenIcon: meta.icon,
        person: person && {
          name: person.name,
          surname: person.surname,
          avatarUrl: person.avatarUrl,
        },
        space: counterpartySpace && {
          title: counterpartySpace.title,
          avatarUrl: counterpartySpace.logoUrl,
        },
        direction,
        counterparty,
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

    console.error('Error while fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions.' },
      { status: 500 },
    );
  }
}
