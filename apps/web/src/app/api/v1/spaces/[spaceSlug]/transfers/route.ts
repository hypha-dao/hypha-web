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
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt, hasEmojiOrLink } from '@hypha-platform/ui-utils';

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

  const startTime = Date.now();
  try {
    console.log(`[Transfers API] Starting request for space: ${spaceSlug}`);

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space || !canConvertToBigInt(space.web3SpaceId)) {
      console.log(`[Transfers API] Space not found: ${spaceSlug}`);
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    console.log(
      `[Transfers API] Space found: ${spaceSlug}, web3SpaceId: ${space.web3SpaceId}`,
    );

    let spaceDetails;
    try {
      spaceDetails = await web3Client.readContract(
        getSpaceDetails({ spaceId: BigInt(space.web3SpaceId as number) }),
      );
      console.log(
        `[Transfers API] Space details fetched, length: ${
          spaceDetails?.length || 0
        }`,
      );
    } catch (web3Error) {
      console.error(
        `[Transfers API] Failed to fetch space details for ${spaceSlug}:`,
        web3Error,
      );
      throw web3Error;
    }

    const spaceAddress = spaceDetails.at(9) as `0x${string}`;
    if (!spaceAddress) {
      console.error(
        `[Transfers API] Space address not found for space ${spaceSlug}. spaceDetails length: ${spaceDetails.length}`,
      );
      return NextResponse.json(
        { error: 'Space address not found' },
        { status: 500 },
      );
    }
    console.log(`[Transfers API] Space address: ${spaceAddress}`);

    let transfers;
    try {
      console.log(
        `[Transfers API] Fetching transfers for address: ${spaceAddress}`,
      );
      transfers = await getTransfersByAddress({
        address: spaceAddress,
        contractAddresses: token,
        fromDate,
        toDate,
        fromBlock,
        toBlock,
        limit,
      });
      console.log(`[Transfers API] Fetched ${transfers.length} transfers`);
    } catch (transfersError) {
      console.error(
        `[Transfers API] Failed to fetch transfers for ${spaceSlug} (${spaceAddress}):`,
        transfersError,
      );
      throw transfersError;
    }

    let dbTransfers: Awaited<ReturnType<typeof findAllTransfers>>;
    try {
      console.log(`[Transfers API] Fetching DB transfers for ${spaceSlug}`);
      dbTransfers = await findAllTransfers({ db: getDb({ authToken }) }, {});
      console.log(`[Transfers API] Fetched ${dbTransfers.length} DB transfers`);
    } catch (dbTransfersError) {
      console.error(
        `[Transfers API] Failed to fetch DB transfers for ${spaceSlug}:`,
        dbTransfersError,
      );
      // Continue without DB transfers - memo will be null
      dbTransfers = [] as Awaited<ReturnType<typeof findAllTransfers>>;
    }

    const memoMap = new Map(
      dbTransfers.map((dbTransfer) => [
        dbTransfer.transactionHash.toLowerCase(),
        dbTransfer.memo,
      ]),
    );

    let rawDbTokens: Awaited<ReturnType<typeof findAllTokens>>;
    try {
      console.log(`[Transfers API] Fetching DB tokens for ${spaceSlug}`);
      rawDbTokens = await findAllTokens({ db }, { search: undefined });
      console.log(`[Transfers API] Fetched ${rawDbTokens.length} DB tokens`);
    } catch (dbTokensError) {
      console.error(
        `[Transfers API] Failed to fetch DB tokens for ${spaceSlug}:`,
        dbTokensError,
      );
      // Continue with empty tokens array
      rawDbTokens = [] as Awaited<ReturnType<typeof findAllTokens>>;
    }
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

    console.log(
      `[Transfers API] Processing ${transfers.length} transfers with entity info for ${spaceSlug}`,
    );
    const transfersWithEntityInfo = await Promise.allSettled(
      transfers.map(async (transfer) => {
        try {
          const isIncoming =
            transfer.to.toUpperCase() === spaceAddress.toUpperCase();
          const direction = isIncoming ? 'incoming' : 'outgoing';
          const counterparty = isIncoming ? 'from' : 'to';

          let meta;
          try {
            meta = await getTokenMeta(
              transfer.token as `0x${string}`,
              dbTokens,
            );
          } catch (metaError) {
            console.warn(
              `Failed to get token meta for ${transfer.token}, using fallback values:`,
              metaError,
            );
            // Use fallback values from transfer if getTokenMeta fails
            meta = {
              name: 'Unnamed',
              symbol: transfer.symbol || 'UNKNOWN',
              icon: '/placeholder/neutral-token-icon.svg',
              type: null,
            };
          }

          const name = meta.name || 'Unnamed';
          const symbol = meta.symbol || 'UNKNOWN';
          if (hasEmojiOrLink(name) || hasEmojiOrLink(symbol)) {
            return null;
          }

          const counterpartyAddress = isIncoming ? transfer.from : transfer.to;
          let person = undefined;
          let space = undefined;

          try {
            person =
              (await findPersonByWeb3Address(
                { address: counterpartyAddress },
                { db },
              )) || undefined;
          } catch (personError) {
            console.warn(
              `Failed to find person for address ${counterpartyAddress} for space ${spaceSlug}:`,
              personError,
            );
          }

          if (!person) {
            try {
              space =
                (await findSpaceByAddress(
                  { address: counterpartyAddress },
                  { db },
                )) || undefined;
            } catch (spaceError) {
              console.warn(
                `Failed to find space for address ${counterpartyAddress} for space ${spaceSlug}:`,
                spaceError,
              );
            }
          }

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
        } catch (err) {
          console.error(
            `Error processing transfer ${transfer.transaction_hash} for space ${spaceSlug}:`,
            err,
          );
          return null;
        }
      }),
    );

    const validTransfers = transfersWithEntityInfo
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter((t) => t !== null);

    const failedCount = transfersWithEntityInfo.filter(
      (r) => r.status === 'rejected',
    ).length;
    if (failedCount > 0) {
      console.warn(
        `[Transfers API] ${failedCount} transfers failed to process for ${spaceSlug}`,
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Transfers API] Completed request for ${spaceSlug}: ${validTransfers.length} valid transfers in ${duration}ms`,
    );

    return NextResponse.json(validTransfers);
  } catch (error: unknown) {
    const errorMessage =
      (error instanceof Error && error.message) ||
      (typeof error === 'object' &&
        error !== null &&
        'shortMessage' in error &&
        typeof error.shortMessage === 'string' &&
        error.shortMessage) ||
      JSON.stringify(error);
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      console.warn('Rate limit exceeded calling blockchain:', errorMessage);
      return NextResponse.json(
        {
          error: 'External API rate limit exceeded. Please try again later.',
        },
        { status: 503 },
      );
    }

    const duration = Date.now() - startTime;
    console.error(
      `[Transfers API] Error while fetching transactions for space ${spaceSlug} (after ${duration}ms):`,
      error,
    );
    if (error instanceof Error) {
      console.error('[Transfers API] Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch transactions.',
        details:
          process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 },
    );
  }
}
