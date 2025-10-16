import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenPrice,
  findPersonBySlug,
  getDb,
  getTokenBalancesByAddress,
  findAllTokens,
  getBalance,
  getTokenMeta,
  getSupply,
} from '@hypha-platform/core/server';
import {
  TOKENS,
  Token,
  validTokenTypes,
  TokenType,
  getTokenDecimals,
  getEnergyBalances,
} from '@hypha-platform/core/client';
import { headers } from 'next/headers';
import { hasEmojiOrLink, tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { ProfileRouteParams } from '@hypha-platform/epics';
import { web3Client } from '@hypha-platform/core/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<ProfileRouteParams> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    let energyBalanceRaw: bigint = 0n;
    let energyTokenAddress: `0x${string}` | undefined = undefined;

    try {
      const config = getEnergyBalances({ member: address });
      const result = await web3Client.readContract(config);
      energyBalanceRaw = BigInt(result[0]);
      energyTokenAddress = result[1] as `0x${string}`;
    } catch (error) {
      console.warn('Failed to fetch energy balance:', error);
    }

    let externalTokens: any[] = [];
    try {
      externalTokens = await getTokenBalancesByAddress(address);
    } catch (error) {
      console.warn('Failed to fetch external token balances:', error);
    }

    const parsedExternalTokens: Token[] = externalTokens
      .filter(
        (token) =>
          token?.tokenAddress &&
          /^0x[a-fA-F0-9]{40}$/i.test(token.tokenAddress),
      )
      .map((token) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unnamed',
        address: token.tokenAddress as `0x${string}`,
        icon: token.logo || '/placeholder/token-icon.svg',
        type: 'utility' as const,
      }));

    const filteredExternalTokens = parsedExternalTokens.filter((token) => {
      return !hasEmojiOrLink(token.symbol) && !hasEmojiOrLink(token.name);
    });

    const addressMap = new Map<string, Token>();
    TOKENS.forEach((token) =>
      addressMap.set(token.address.toLowerCase(), token),
    );
    filteredExternalTokens.forEach((token) => {
      if (!addressMap.has(token.address.toLowerCase())) {
        addressMap.set(token.address.toLowerCase(), token);
      }
    });

    if (energyTokenAddress) {
      const lower = energyTokenAddress.toLowerCase();
      if (!addressMap.has(lower)) {
        let name = 'Unnamed';
        let symbol = 'UNKNOWN';
        try {
          name = await web3Client.readContract({
            address: energyTokenAddress,
            abi: [
              {
                type: 'function',
                inputs: [],
                name: 'name',
                outputs: [{ internalType: 'string', type: 'string' }],
                stateMutability: 'view',
              },
            ],
            functionName: 'name',
          });
          symbol = await web3Client.readContract({
            address: energyTokenAddress,
            abi: [
              {
                type: 'function',
                inputs: [],
                name: 'symbol',
                outputs: [{ internalType: 'string', type: 'string' }],
                stateMutability: 'view',
              },
            ],
            functionName: 'symbol',
          });
        } catch (error) {
          console.warn('Failed to fetch energy token metadata:', error);
        }
        const token: Token = {
          name,
          symbol,
          address: energyTokenAddress,
          icon: '/placeholder/token-icon.svg',
          type: 'utility' as const,
        };
        addressMap.set(lower, token);
      }
    }

    const allTokens: Token[] = Array.from(addressMap.values());

    let prices: Record<string, number | undefined> = {};
    try {
      prices = await getTokenPrice(allTokens.map(({ address }) => address));
    } catch (error: unknown) {
      console.error('Failed to fetch token prices:', error);
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

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address, dbTokens);
          const isEnergyToken =
            token.address.toLowerCase() === energyTokenAddress?.toLowerCase();
          let amount: number;
          const decimals = await getTokenDecimals(token.address);
          if (isEnergyToken) {
            amount =
              Number(energyBalanceRaw / 10n ** BigInt(decimals)) +
              Number(energyBalanceRaw % 10n ** BigInt(decimals)) /
                10 ** decimals;
          } else {
            const { amount: rawAmount } = await getBalance(
              token.address,
              address,
            );
            amount = rawAmount;
          }
          let totalSupply: bigint | undefined;
          try {
            const supply = await getSupply(token.address);
            totalSupply = supply.totalSupply;
          } catch (err) {
            console.warn(
              `Failed to fetch supply for token ${token.address}: ${err}`,
            );
          }
          const rate = prices[token.address] || 0;
          return {
            ...meta,
            address: token.address,
            value: amount,
            usdEqual: rate * amount,
            chartData: [],
            transactions: [],
            closeUrl: [],
            slug: '',
            supply: totalSupply
              ? {
                  total: Number(totalSupply / 10n ** BigInt(decimals)),
                }
              : undefined,
            space: meta.space
              ? {
                  slug: meta.space.slug,
                  title: meta.space.title,
                }
              : undefined,
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

    const sorted = validAssets.sort((a, b) =>
      a.usdEqual === b.usdEqual ? b.value - a.value : b.usdEqual - a.usdEqual,
    );

    return NextResponse.json({
      assets: sorted,
      balance: sorted.reduce((sum, asset) => sum + asset.usdEqual, 0),
    });
  } catch (error) {
    console.error('Failed to fetch user assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user assets.' },
      { status: 500 },
    );
  }
}
