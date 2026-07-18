import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getDb,
  getTokenBalancesByAddress,
  getTokenMeta,
  findAllTokens,
} from '@hypha-platform/core/server';
import {
  Token,
  validTokenTypes,
  TokenType,
  isHiddenToken,
  isKnownTreasuryToken,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { hasEmojiOrLink } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const { searchParams } = new URL(request.url);
  const walletRaw = searchParams.get('address')?.trim() ?? '';

  if (!EVM_ADDRESS.test(walletRaw)) {
    return NextResponse.json(
      { error: 'Valid address query parameter is required.' },
      { status: 400 },
    );
  }

  const walletAddress = walletRaw as `0x${string}`;

  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

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

    let externalTokens: Awaited<ReturnType<typeof getTokenBalancesByAddress>> =
      [];
    try {
      externalTokens = await getTokenBalancesByAddress(walletAddress);
    } catch (error: unknown) {
      console.warn('Failed to fetch wallet token balances:', error);
    }

    const dbKnownAddresses = new Set(
      rawDbTokens
        .filter((t) => t.address && EVM_ADDRESS.test(t.address))
        .map((t) => t.address!.toLowerCase()),
    );

    const parsedExternalTokens: Token[] = externalTokens
      .filter(
        (token) =>
          token &&
          token.balance > 0 &&
          token.tokenAddress &&
          EVM_ADDRESS.test(token.tokenAddress) &&
          isKnownTreasuryToken(token.tokenAddress, dbKnownAddresses),
      )
      .map((token) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unnamed',
        address: token.tokenAddress as `0x${string}`,
        icon: token.logo || '/placeholder/token-icon.svg',
        type: 'utility' as const,
      }));

    const addressMap = new Map<string, Token>();
    parsedExternalTokens.forEach((token) => {
      addressMap.set(token.address.toLowerCase(), token);
    });

    const allTokens: Token[] = Array.from(addressMap.values()).filter(
      (token) => !isHiddenToken(token.address),
    );

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address, dbTokens);
          // Exclude only when DB/on-chain explicitly marks non-transferable; `undefined` means
          // "not in DB for this address" and must not drop wallet-held catalogue tokens (e.g. TOA).
          if (meta.transferable === false) {
            return null;
          }
          if (hasEmojiOrLink(meta.name) || hasEmojiOrLink(meta.symbol)) {
            return null;
          }
          return {
            ...meta,
            address: token.address,
          };
        } catch (err) {
          console.warn(`Skipping token ${token.address}: ${err}`);
          return null;
        }
      }),
    );

    const validAssets = assets.filter((a) => a !== null) as NonNullable<
      (typeof assets)[0]
    >[];

    return NextResponse.json({ assets: validAssets });
  } catch (error) {
    console.error('Failed to fetch wallet transferable tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet tokens.' },
      { status: 500 },
    );
  }
}
