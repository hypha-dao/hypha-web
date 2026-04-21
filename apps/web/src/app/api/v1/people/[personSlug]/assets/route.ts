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
  getMutualCreditInfo,
} from '@hypha-platform/core/server';
import {
  TOKENS,
  Token,
  validTokenTypes,
  TokenType,
  getTokenDecimals,
  getEnergyBalances,
  getMemberSpaces,
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

    /**
     * Spaces the user is a member of (web3 ids). Used below to surface tokens the user
     * can spend on credit even when their on-chain balance is zero.
     */
    let memberWeb3SpaceIds: Set<number> = new Set();
    try {
      const result = (await web3Client.readContract(
        getMemberSpaces({ memberAddress: address }),
      )) as readonly bigint[];
      memberWeb3SpaceIds = new Set(result.map((id) => Number(id)));
    } catch (error) {
      console.warn('Failed to fetch member spaces:', error);
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

    /**
     * Also include every dbToken that has a deployed address — this lets us surface
     * credit-enabled tokens even when the user has 0 balance and never held them
     * (so they appear in transfer dropdowns when eligible by space membership).
     * Non-credit tokens with 0 balance are filtered out below.
     */
    const rawDbTokensForSeed = await findAllTokens(
      { db: getDb({ authToken }) },
      { search: undefined },
    );
    rawDbTokensForSeed.forEach((t) => {
      if (!t.address) return;
      const lower = t.address.toLowerCase();
      if (addressMap.has(lower)) return;
      addressMap.set(lower, {
        symbol: t.symbol ?? 'UNKNOWN',
        name: t.name ?? 'Unnamed',
        address: t.address as `0x${string}`,
        icon: t.iconUrl ?? '/placeholder/token-icon.svg',
        type: validTokenTypes.includes(t.type as TokenType)
          ? (t.type as TokenType)
          : 'utility',
      });
    });

    const allTokens: Token[] = Array.from(addressMap.values());

    let prices: Record<string, number | undefined> = {};
    try {
      prices = await getTokenPrice(allTokens.map(({ address }) => address));
    } catch (error: unknown) {
      console.error('Failed to fetch token prices:', error);
    }

    const rawDbTokens = rawDbTokensForSeed;
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

    const referencePriceByAddress: Record<string, number> = {};
    rawDbTokens.forEach((t) => {
      if (t.address && t.referencePrice != null) {
        const parsed = Number(t.referencePrice);
        if (Number.isFinite(parsed) && parsed >= 0) {
          referencePriceByAddress[t.address.toLowerCase()] = parsed;
        }
      }
    });

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
          let rate = isEnergyToken ? 1 : prices[token.address] || 0;
          if (rate === 0) {
            rate = referencePriceByAddress[token.address.toLowerCase()] ?? 0;
          }
          /**
           * Mutual credit only exists on RegularSpaceToken instances. We attempt the
           * read for every token but skip the energy token (different contract). The
           * helper returns `null` when the contract doesn't expose credit functions
           * so non-RegularSpaceToken tokens silently get no credit metadata.
           */
          const mutualCredit = isEnergyToken
            ? null
            : await getMutualCreditInfo(token.address, address);
          return {
            ...meta,
            address: token.address,
            value: amount,
            tokenPrice: rate,
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
            mutualCredit:
              mutualCredit && mutualCredit.isCreditEnabled
                ? {
                    defaultCreditLimit: mutualCredit.defaultCreditLimit,
                    creditBalance: mutualCredit.creditBalance,
                    netBalance: mutualCredit.netBalance,
                    whitelistedSpaceIds: mutualCredit.whitelistedSpaceIds,
                    creditLimit: mutualCredit.creditLimit,
                    creditLimitLeft: mutualCredit.creditLimitLeft,
                    /**
                     * The user is credit-eligible if any space they are a member of is
                     * in the token's credit whitelist. We rely on the on-chain whitelist
                     * because the contract authorizes credit by space membership.
                     */
                    creditEligible: mutualCredit.whitelistedSpaceIds.some(
                      (id) => memberWeb3SpaceIds.has(id),
                    ),
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

    /**
     * Keep tokens with non-zero balance, predefined `TOKENS` (e.g. HYPHA, USDC), the
     * energy token, and credit-eligible tokens (so users see and can spend on credit
     * even at 0 balance). Drop the noise of every zero-balance space token in the DB.
     */
    const knownAddresses = new Set<string>([
      ...TOKENS.map((t) => t.address.toLowerCase()),
      ...filteredExternalTokens.map((t) => t.address.toLowerCase()),
      ...(energyTokenAddress ? [energyTokenAddress.toLowerCase()] : []),
    ]);
    const visibleAssets = validAssets.filter((a) => {
      if (a.value > 0) return true;
      if (knownAddresses.has(a.address.toLowerCase())) return true;
      const mc = (a as { mutualCredit?: { creditEligible?: boolean } })
        .mutualCredit;
      return Boolean(mc?.creditEligible);
    });

    const sorted = visibleAssets.sort((a, b) =>
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
