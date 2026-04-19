'use client';

import { RecipientField } from '../components/common/recipient-field';
import { RecipientType } from '../components/common/recipient';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import {
  Person,
  Space,
  TOKENS,
  getBalance,
  publicClient,
  useMe,
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
  getEscrowImplementationAddress,
  canBuyerSendToEscrowForExchange,
  canExecutorSendToEscrowForExchange,
} from '@hypha-platform/core/client';
import { decayingSpaceTokenAbi } from '@hypha-platform/core/generated';
import { useChainId } from 'wagmi';
import {
  useTokens,
  useWalletTransferableTokens,
  type ExtendedToken,
} from '../../../treasury';
import type { Token as PayoutToken } from '../components/common/token-payout-field-array';
import { useTranslations } from 'next-intl';
import React from 'react';
import useSWR from 'swr';
import { useFormContext, useWatch } from 'react-hook-form';
import { useParams } from 'next/navigation';
import { useSellerLegBalanceValidation } from './use-seller-leg-balance-validation';

const isEvmAddress = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

function toPayoutTokens(tokens: ExtendedToken[]): PayoutToken[] {
  return tokens.map((token) => ({
    address: token.address,
    icon: token.icon,
    symbol: token.symbol,
    space: token.space,
    type: token.type === 'liquid' ? null : token.type,
  }));
}

export const ExchangeStakesAndTokensPlugin = ({
  spaceSlug,
  members,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const sellerAmountExceedsMessage = tAgreementFlow(
    'plugins.exchangeStakesAndTokens.errors.sellerAmountExceedsBalance',
  );
  const sellerAmountTooSmallMessage = tAgreementFlow(
    'plugins.exchangeStakesAndTokens.errors.sellerAmountTooSmall',
  );
  useSellerLegBalanceValidation({
    exceedsBalance: sellerAmountExceedsMessage,
    amountTooSmall: sellerAmountTooSmallMessage,
  });
  const { control, setValue } = useFormContext();
  const params = useParams();
  const currentSpaceSlug = params.id as string;
  const { space: activeSpace } = useSpaceBySlug(currentSpaceSlug);
  const { person: creator } = useMe();
  const [sellerRecipientType, setSellerRecipientType] =
    React.useState<RecipientType>('member');
  const [buyerRecipientType, setBuyerRecipientType] =
    React.useState<RecipientType>('member');
  const sellerAddress = useWatch({ control, name: 'sellerAddress' }) as
    | string
    | undefined;
  const buyerAddress = useWatch({ control, name: 'buyerAddress' }) as
    | string
    | undefined;
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const chainId = useChainId();
  const escrowContractAddress = getEscrowImplementationAddress();

  const sellerSpaces = React.useMemo(() => {
    if (!activeSpace?.address) return spaces;
    if (!spaces?.length) return [activeSpace];
    const hasActiveSpace = spaces.some(
      (space) =>
        space.address?.toLowerCase() === activeSpace.address?.toLowerCase(),
    );
    return hasActiveSpace ? spaces : [activeSpace, ...spaces];
  }, [activeSpace, spaces]);

  const buyerSpaces = sellerSpaces;

  /**
   * Resolve which space (from `sellerSpaces`) the user has selected as seller,
   * so we can look up the correct executor for balance/whitelist checks. The
   * selected space may be the active DHO or any other — the form is free.
   */
  const sellerSpaceMeta = React.useMemo(() => {
    if (sellerRecipientType !== 'space') return null;
    if (!sellerAddress) return null;
    const lower = sellerAddress.toLowerCase();
    return (
      sellerSpaces?.find((s) => s.address?.toLowerCase() === lower) ?? null
    );
  }, [sellerAddress, sellerRecipientType, sellerSpaces]);

  const {
    spaceDetails: sellerSpaceChainDetails,
    isLoading: isLoadingSellerSpaceChain,
  } = useSpaceDetailsWeb3Rpc({
    spaceId: sellerSpaceMeta?.web3SpaceId ?? null,
  });

  /** On execution, batched approve/escrow run as the selected seller-space executor. */
  const sellerExecutorAddress = sellerSpaceChainDetails?.executor as
    | string
    | undefined;

  const sellerBalanceLookupAddress =
    sellerRecipientType === 'space' && sellerExecutorAddress
      ? sellerExecutorAddress
      : sellerAddress;

  const buyerSpaceMeta = React.useMemo(() => {
    if (buyerRecipientType !== 'space') return null;
    if (!buyerAddress) return null;
    const lower = buyerAddress.toLowerCase();
    return buyerSpaces?.find((s) => s.address?.toLowerCase() === lower) ?? null;
  }, [buyerAddress, buyerRecipientType, buyerSpaces]);

  const {
    spaceDetails: buyerSpaceChainDetails,
    isLoading: isLoadingBuyerSpaceChain,
  } = useSpaceDetailsWeb3Rpc({
    spaceId: buyerSpaceMeta?.web3SpaceId ?? null,
  });

  const buyerExecutorAddress = buyerSpaceChainDetails?.executor as
    | string
    | undefined;

  const buyerBalanceLookupAddress =
    buyerRecipientType === 'space' && buyerExecutorAddress
      ? buyerExecutorAddress
      : buyerAddress;

  /**
   * Helpful default: on first mount, prefill seller with the current member so
   * the form starts in a usable state. We never overwrite a user-picked value.
   */
  const didSeedSeller = React.useRef(false);
  React.useEffect(() => {
    if (didSeedSeller.current) return;
    if (sellerAddress) {
      didSeedSeller.current = true;
      return;
    }
    const creatorAddress =
      creator?.address ||
      members.find((member) => member.id === creator?.id)?.address;
    if (creatorAddress) {
      setValue('sellerAddress', creatorAddress, {
        shouldDirty: true,
        shouldValidate: false,
      });
      didSeedSeller.current = true;
    }
  }, [creator?.address, creator?.id, members, sellerAddress, setValue]);

  React.useEffect(() => {
    setValue('sellerRecipientType', sellerRecipientType, {
      shouldDirty: true,
    });
  }, [sellerRecipientType, setValue]);

  React.useEffect(() => {
    setValue('buyerRecipientType', buyerRecipientType, { shouldDirty: true });
  }, [buyerRecipientType, setValue]);

  React.useEffect(() => {
    if (
      buyerRecipientType === 'space' &&
      buyerExecutorAddress &&
      isEvmAddress(buyerExecutorAddress)
    ) {
      setValue('buyerExecutorAddressForSettlement', buyerExecutorAddress, {
        shouldDirty: true,
      });
    } else {
      setValue('buyerExecutorAddressForSettlement', '', { shouldDirty: true });
    }
  }, [buyerRecipientType, buyerExecutorAddress, setValue]);

  React.useEffect(() => {
    if (
      sellerRecipientType === 'space' &&
      sellerExecutorAddress &&
      isEvmAddress(sellerExecutorAddress)
    ) {
      setValue('spaceExecutorAddress', sellerExecutorAddress, {
        shouldDirty: true,
      });
    } else {
      setValue('spaceExecutorAddress', '', { shouldDirty: true });
    }
  }, [sellerRecipientType, sellerExecutorAddress, setValue]);

  /**
   * Tokens for the active DHO come from `useTokens({ spaceSlug })` (same slug as the URL).
   * Do not filter by `token.space?.slug`: on-chain space tokens often have no DB `spaceId`,
   * so metadata omits `space` and would incorrectly drop COA/TOA/USDC from the seller list.
   */
  const catalogueSellerTokens = React.useMemo(
    () =>
      (tokens as ExtendedToken[]).filter(
        (token) => token.transferable !== false,
      ),
    [tokens],
  );

  const { tokens: walletSellerTokens, isLoading: isLoadingWalletSellerTokens } =
    useWalletTransferableTokens({
      spaceSlug,
      walletAddress:
        sellerRecipientType === 'member' && isEvmAddress(sellerAddress)
          ? sellerAddress
          : undefined,
    });

  const {
    tokens: walletSpaceExecutorTokens,
    isLoading: isLoadingWalletSpaceExecutorTokens,
  } = useWalletTransferableTokens({
    spaceSlug,
    walletAddress:
      sellerRecipientType === 'space' && isEvmAddress(sellerExecutorAddress)
        ? sellerExecutorAddress
        : undefined,
  });

  /**
   * When the seller is a *different* space than the active one (the URL-bound
   * space whose catalogue we already fetched as `catalogueSellerTokens`),
   * pull that other space's token catalogue too — otherwise picking that
   * space as the seller would only show the executor's spot balances.
   */
  const {
    tokens: sellerSpaceCatalogueTokens,
    isLoading: isLoadingSellerSpaceCatalogue,
  } = useTokens({
    spaceSlug:
      sellerRecipientType === 'space' &&
      sellerSpaceMeta?.slug &&
      sellerSpaceMeta.slug !== spaceSlug
        ? sellerSpaceMeta.slug
        : '',
  });

  /**
   * Member seller: union space catalogue + personal wallet (other spaces' mints).
   * Space seller: union on-chain catalogue for the space + executor treasury holdings (Alchemy).
   */
  const sellerTokenCandidates = React.useMemo(() => {
    if (sellerRecipientType === 'member') {
      const byKey = new Map<string, ExtendedToken>();
      for (const t of catalogueSellerTokens) {
        byKey.set(t.address.toLowerCase(), t);
      }
      for (const t of walletSellerTokens) {
        const k = t.address.toLowerCase();
        if (!byKey.has(k)) {
          byKey.set(k, t as ExtendedToken);
        }
      }
      return Array.from(byKey.values());
    }
    if (sellerRecipientType === 'space') {
      const byKey = new Map<string, ExtendedToken>();
      const sellerCatalogue =
        sellerSpaceMeta?.slug && sellerSpaceMeta.slug !== spaceSlug
          ? sellerSpaceCatalogueTokens
          : catalogueSellerTokens;
      for (const t of sellerCatalogue) {
        byKey.set(t.address.toLowerCase(), t as ExtendedToken);
      }
      for (const t of walletSpaceExecutorTokens) {
        const k = t.address.toLowerCase();
        if (!byKey.has(k)) {
          byKey.set(k, t as ExtendedToken);
        }
      }
      return Array.from(byKey.values());
    }
    return catalogueSellerTokens;
  }, [
    catalogueSellerTokens,
    sellerRecipientType,
    sellerSpaceCatalogueTokens,
    sellerSpaceMeta?.slug,
    spaceSlug,
    walletSellerTokens,
    walletSpaceExecutorTokens,
  ]);

  /**
   * Tokens issued by the seller-space (its own catalogue) — these are the
   * candidates whose `autoMinting` flag we care about. A space-seller may
   * legitimately fund an exchange even when its executor's balance is 0,
   * provided the token contract auto-mints on demand from the executor.
   */
  const sellerSpaceCatalogueAddresses = React.useMemo(() => {
    if (sellerRecipientType !== 'space') return [] as `0x${string}`[];
    const source = (
      sellerSpaceMeta?.slug && sellerSpaceMeta.slug !== spaceSlug
        ? sellerSpaceCatalogueTokens
        : catalogueSellerTokens
    ) as ExtendedToken[];
    return source
      .map((t: ExtendedToken) => t.address as `0x${string}`)
      .filter((addr: `0x${string}`): addr is `0x${string}` =>
        /^0x[a-fA-F0-9]{40}$/.test(addr),
      );
  }, [
    catalogueSellerTokens,
    sellerRecipientType,
    sellerSpaceCatalogueTokens,
    sellerSpaceMeta?.slug,
    spaceSlug,
  ]);

  const { data: sellerAutoMintEnabledSet, isLoading: isLoadingSellerAutoMint } =
    useSWR(
      sellerSpaceCatalogueAddresses.length > 0
        ? [
            'exchangeSellerAutoMintFlags',
            ...sellerSpaceCatalogueAddresses.map((a: `0x${string}`) =>
              a.toLowerCase(),
            ),
          ]
        : null,
      async () => {
        const reads = await publicClient.multicall({
          allowFailure: true,
          blockTag: 'latest',
          contracts: sellerSpaceCatalogueAddresses.map(
            (address: `0x${string}`) => ({
              address,
              abi: decayingSpaceTokenAbi,
              functionName: 'autoMinting' as const,
            }),
          ),
        });
        const enabled = new Set<string>();
        sellerSpaceCatalogueAddresses.forEach(
          (address: `0x${string}`, idx: number) => {
            const r = reads[idx];
            if (r?.status === 'success' && r.result === true) {
              enabled.add(address.toLowerCase());
            }
          },
        );
        return enabled;
      },
      { revalidateOnFocus: false },
    );

  const { tokens: buyerWalletTokens, isLoading: isLoadingBuyerTokenList } =
    useWalletTransferableTokens({
      spaceSlug,
      walletAddress: buyerBalanceLookupAddress,
    });

  /**
   * When the buyer is a space, pull that space's own token catalogue (the
   * tokens the space has created) so they appear in the picker even when the
   * executor currently holds a zero balance.
   */
  const {
    tokens: buyerSpaceCatalogueTokens,
    isLoading: isLoadingBuyerSpaceCatalogue,
  } = useTokens({
    spaceSlug:
      buyerRecipientType === 'space' && buyerSpaceMeta?.slug
        ? buyerSpaceMeta.slug
        : '',
  });

  /**
   * Space buyers get: `TOKENS` defaults (USDC/EURC/WETH/cbBTC/HYPHA) ∪ the
   * space's own minted tokens ∪ anything the executor currently holds.
   * Member buyers keep the previous behaviour — only their transferable wallet
   * tokens.
   */
  const buyerTokenCandidates = React.useMemo(() => {
    if (buyerRecipientType !== 'space') return buyerWalletTokens;
    const byKey = new Map<string, ExtendedToken>();
    const push = (token: ExtendedToken | undefined) => {
      if (!token) return;
      const k = token.address.toLowerCase();
      if (!byKey.has(k)) byKey.set(k, token);
    };
    for (const t of TOKENS) {
      push({
        address: t.address,
        icon: t.icon,
        name: t.name,
        symbol: t.symbol,
        type: t.type,
        transferable: t.transferable,
      } as ExtendedToken);
    }
    if (buyerSpaceMeta?.slug === spaceSlug) {
      // Active space as buyer — reuse the catalogue we already fetched for the
      // seller path to avoid a duplicate HTTP call.
      for (const t of catalogueSellerTokens) push(t);
    } else {
      for (const t of buyerSpaceCatalogueTokens) push(t as ExtendedToken);
    }
    for (const t of buyerWalletTokens) push(t as ExtendedToken);
    return Array.from(byKey.values());
  }, [
    buyerRecipientType,
    buyerSpaceCatalogueTokens,
    buyerSpaceMeta?.slug,
    buyerWalletTokens,
    catalogueSellerTokens,
    spaceSlug,
  ]);

  const { data: sellerOwnedTokenSet, isLoading: isLoadingSellerBalances } =
    useSWR(
      isEvmAddress(sellerBalanceLookupAddress) && sellerTokenCandidates.length
        ? [
            'exchangeSellerOwnedTokens',
            sellerBalanceLookupAddress,
            sellerRecipientType,
            ...sellerTokenCandidates.map((token) =>
              token.address.toLowerCase(),
            ),
          ]
        : null,
      async () => {
        const balances = await Promise.allSettled(
          sellerTokenCandidates.map(async (token) => {
            const { amount } = await getBalance(
              token.address as `0x${string}`,
              sellerBalanceLookupAddress as `0x${string}`,
            );
            return { tokenAddress: token.address, amount };
          }),
        );

        return new Set(
          balances.flatMap((result) =>
            result.status === 'fulfilled' && result.value.amount > 0
              ? [result.value.tokenAddress.toLowerCase()]
              : [],
          ),
        );
      },
      { revalidateOnFocus: true, revalidateOnReconnect: true },
    );

  const { data: buyerOwnedTokenSet, isLoading: isLoadingBuyerBalances } =
    useSWR(
      // Only gate the buyer picker on balances for member buyers. Space buyers
      // may legitimately select tokens they don't currently hold, so skip.
      buyerRecipientType === 'member' &&
        isEvmAddress(buyerBalanceLookupAddress) &&
        buyerTokenCandidates.length
        ? [
            'exchangeBuyerOwnedTokens',
            buyerBalanceLookupAddress,
            buyerRecipientType,
            ...buyerTokenCandidates.map((token) => token.address.toLowerCase()),
          ]
        : null,
      async () => {
        const balances = await Promise.allSettled(
          buyerTokenCandidates.map(async (token) => {
            const { amount } = await getBalance(
              token.address as `0x${string}`,
              buyerBalanceLookupAddress as `0x${string}`,
            );
            return { tokenAddress: token.address, amount };
          }),
        );

        return new Set(
          balances.flatMap((result) =>
            result.status === 'fulfilled' && result.value.amount > 0
              ? [result.value.tokenAddress.toLowerCase()]
              : [],
          ),
        );
      },
      { revalidateOnFocus: true, revalidateOnReconnect: true },
    );

  const sellerTokensBeforeWhitelist = React.useMemo(() => {
    if (!isEvmAddress(sellerBalanceLookupAddress) || !sellerOwnedTokenSet)
      return [];
    return sellerTokenCandidates.filter((token) => {
      const key = token.address.toLowerCase();
      if (sellerOwnedTokenSet.has(key)) return true;
      // Space-seller variant: tokens minted by the seller space with
      // `autoMinting` active can fund the escrow even with a zero spot
      // balance — the executor mints on demand at proposal-execution time.
      if (
        sellerRecipientType === 'space' &&
        sellerAutoMintEnabledSet?.has(key)
      ) {
        return true;
      }
      return false;
    });
  }, [
    sellerBalanceLookupAddress,
    sellerOwnedTokenSet,
    sellerTokenCandidates,
    sellerRecipientType,
    sellerAutoMintEnabledSet,
  ]);

  const buyerTokensBeforeWhitelist = React.useMemo(() => {
    // Space buyers can legitimately pick tokens they don't currently hold —
    // they may mint their own token, or receive funds before the proposal
    // executes. So skip the "owned balance" gate for spaces.
    if (buyerRecipientType === 'space') {
      return buyerTokenCandidates;
    }
    if (!isEvmAddress(buyerBalanceLookupAddress) || !buyerOwnedTokenSet)
      return [];
    return buyerTokenCandidates.filter((token) =>
      buyerOwnedTokenSet.has(token.address.toLowerCase()),
    );
  }, [
    buyerBalanceLookupAddress,
    buyerOwnedTokenSet,
    buyerRecipientType,
    buyerTokenCandidates,
  ]);

  const { data: sellerEscrowWhitelistOk, error: sellerEscrowWhitelistError, isLoading: isLoadingSellerWhitelist } =
    useSWR(
      escrowContractAddress &&
        isEvmAddress(sellerBalanceLookupAddress) &&
        sellerTokensBeforeWhitelist.length > 0
        ? [
            'exchangeSellerEscrowWhitelist',
            chainId,
            escrowContractAddress,
            sellerBalanceLookupAddress,
            ...sellerTokensBeforeWhitelist.map((t) => t.address.toLowerCase()),
          ]
        : null,
      async () => {
        const allowed = new Set<string>();
        await Promise.all(
          sellerTokensBeforeWhitelist.map(async (token) => {
            const ok = await canExecutorSendToEscrowForExchange({
              tokenAddress: token.address as `0x${string}`,
              executorAddress: sellerBalanceLookupAddress as `0x${string}`,
              escrowAddress: escrowContractAddress as `0x${string}`,
            });
            if (ok) {
              allowed.add(token.address.toLowerCase());
            }
          }),
        );
        return allowed;
      },
      { revalidateOnFocus: false },
    );

  const { data: buyerEscrowWhitelistOk, error: buyerEscrowWhitelistError, isLoading: isLoadingBuyerWhitelist } =
    useSWR(
      escrowContractAddress &&
        isEvmAddress(buyerBalanceLookupAddress) &&
        buyerTokensBeforeWhitelist.length > 0
        ? [
            'exchangeBuyerEscrowWhitelist',
            chainId,
            escrowContractAddress,
            buyerBalanceLookupAddress,
            ...buyerTokensBeforeWhitelist.map((t) => t.address.toLowerCase()),
          ]
        : null,
      async () => {
        const allowed = new Set<string>();
        await Promise.all(
          buyerTokensBeforeWhitelist.map(async (token) => {
            const ok = await canBuyerSendToEscrowForExchange({
              tokenAddress: token.address as `0x${string}`,
              buyerAddress: buyerBalanceLookupAddress as `0x${string}`,
              escrowAddress: escrowContractAddress as `0x${string}`,
            });
            if (ok) {
              allowed.add(token.address.toLowerCase());
            }
          }),
        );
        return allowed;
      },
      { revalidateOnFocus: false },
    );

  const sellerTokens = React.useMemo(() => {
    if (!sellerTokensBeforeWhitelist.length) return [];
    if (!escrowContractAddress) {
      return toPayoutTokens(sellerTokensBeforeWhitelist);
    }
    if (sellerEscrowWhitelistError) {
      return [];
    }
    /** SWR is undefined until resolved; do not treat as "no tokens" (that emptied the dropdown). */
    if (sellerEscrowWhitelistOk === undefined) {
      return toPayoutTokens(sellerTokensBeforeWhitelist);
    }
    const matched = sellerTokensBeforeWhitelist.filter((token) =>
      sellerEscrowWhitelistOk.has(token.address.toLowerCase()),
    );
    return toPayoutTokens(matched);
  }, [
    sellerTokensBeforeWhitelist,
    sellerEscrowWhitelistOk,
    sellerEscrowWhitelistError,
    escrowContractAddress,
  ]);

  const buyerTokens = React.useMemo(() => {
    if (!buyerTokensBeforeWhitelist.length) return [];
    if (!escrowContractAddress) {
      return toPayoutTokens(buyerTokensBeforeWhitelist);
    }
    if (buyerEscrowWhitelistError) {
      return [];
    }
    if (buyerEscrowWhitelistOk === undefined) {
      return toPayoutTokens(buyerTokensBeforeWhitelist);
    }
    const matched = buyerTokensBeforeWhitelist.filter((token) =>
      buyerEscrowWhitelistOk.has(token.address.toLowerCase()),
    );
    return toPayoutTokens(matched);
  }, [
    buyerTokensBeforeWhitelist,
    buyerEscrowWhitelistOk,
    buyerEscrowWhitelistError,
    escrowContractAddress,
  ]);

  /** Buyer leg only — do not use seller `useTokens` `isLoading` here (it hid buyer loading behind an empty panel). */
  const sellerBalancesPending =
    isEvmAddress(sellerBalanceLookupAddress) &&
    sellerTokenCandidates.length > 0 &&
    sellerOwnedTokenSet === undefined;
  const buyerBalancesPending =
    buyerRecipientType === 'member' &&
    isEvmAddress(buyerBalanceLookupAddress) &&
    buyerTokenCandidates.length > 0 &&
    buyerOwnedTokenSet === undefined;

  const isBuyerLegLoading =
    isLoadingBuyerTokenList ||
    (buyerRecipientType === 'space' &&
      (isLoadingBuyerSpaceChain || isLoadingBuyerSpaceCatalogue)) ||
    (buyerRecipientType === 'member' &&
      isEvmAddress(buyerBalanceLookupAddress) &&
      isLoadingBuyerBalances) ||
    buyerBalancesPending ||
    (buyerTokensBeforeWhitelist.length > 0 && isLoadingBuyerWhitelist);

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={sellerSpaces}
        defaultRecipientType="member"
        label={tAgreementFlow('plugins.exchangeStakesAndTokens.seller')}
        name="sellerAddress"
        recipientType={sellerRecipientType}
        onRecipientTypeChange={setSellerRecipientType}
      />
      <Separator />
      <Skeleton
        loading={
          isLoading ||
          (sellerRecipientType === 'member' && isLoadingWalletSellerTokens) ||
          (sellerRecipientType === 'space' &&
            (isLoadingSellerSpaceChain ||
              isLoadingWalletSpaceExecutorTokens ||
              isLoadingSellerSpaceCatalogue ||
              isLoadingSellerAutoMint)) ||
          (isEvmAddress(sellerBalanceLookupAddress) &&
            isLoadingSellerBalances) ||
          sellerBalancesPending ||
          (sellerTokensBeforeWhitelist.length > 0 && isLoadingSellerWhitelist)
        }
        width="100%"
        height={90}
      >
        <TokenPayoutFieldArray
          tokens={sellerTokens}
          name="sellerLeg"
          label={tAgreementFlow(
            'plugins.exchangeStakesAndTokens.sellerWillSend',
          )}
        />
      </Skeleton>
      <Separator />
      <RecipientField
        members={members}
        spaces={buyerSpaces}
        defaultRecipientType="member"
        label={tAgreementFlow('plugins.exchangeStakesAndTokens.buyer')}
        name="buyerAddress"
        recipientType={buyerRecipientType}
        onRecipientTypeChange={setBuyerRecipientType}
      />
      <Separator />
      {isBuyerLegLoading ? (
        <div
          className="flex items-center gap-2 text-sm text-neutral-10 py-8 min-h-[90px]"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="animate-spin w-5 h-5 shrink-0" aria-hidden />
          {tAgreementFlow('plugins.exchangeStakesAndTokens.loadingTokens')}
        </div>
      ) : (
        <TokenPayoutFieldArray
          tokens={buyerTokens}
          name="buyerLeg"
          label={tAgreementFlow(
            'plugins.exchangeStakesAndTokens.buyerWillSend',
          )}
        />
      )}
      <div
        className="rounded-[8px] p-5 border border-accent-6 bg-accent-surface max-w-full flex gap-3 md:gap-5 items-center"
        role="note"
      >
        <ExclamationTriangleIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0"
          aria-hidden
        />
        <p className="text-2 text-foreground flex-1 min-w-0">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.escrowNotice', {
            activeSpace: activeSpace?.title?.trim() || 'this space',
          })}
        </p>
      </div>
    </div>
  );
};