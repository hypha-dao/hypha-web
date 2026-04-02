'use client';

import { RecipientField } from '../components/common/recipient-field';
import { RecipientType } from '../components/common/recipient';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import {
  Person,
  Space,
  getBalance,
  useMe,
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
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
  useSellerLegBalanceValidation(sellerAmountExceedsMessage);
  const { control, setValue } = useFormContext();
  const params = useParams();
  const currentSpaceSlug = params.id as string;
  const { space: activeSpace } = useSpaceBySlug(currentSpaceSlug);
  const { spaceDetails, isLoading: isLoadingActiveSpaceChain } =
    useSpaceDetailsWeb3Rpc({
      spaceId: activeSpace?.web3SpaceId ?? null,
    });
  /** On execution, batched approve/escrow run as space executor — balance checks use this when available. */
  const spaceExecutorAddress = spaceDetails?.executor as string | undefined;
  const currentSpaceAddress = activeSpace?.address ?? undefined;
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
  const activeSpaceCatalogueSlug = activeSpace?.slug ?? currentSpaceSlug;

  const sellerBalanceLookupAddress =
    sellerRecipientType === 'space' && spaceExecutorAddress
      ? spaceExecutorAddress
      : sellerAddress;

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

  const buyerSpaceMeta = React.useMemo(() => {
    if (!buyerAddress) return null;
    const lower = buyerAddress.toLowerCase();
    return buyerSpaces?.find((s) => s.address?.toLowerCase() === lower) ?? null;
  }, [buyerAddress, buyerSpaces]);

  const {
    spaceDetails: buyerSpaceChainDetails,
    isLoading: isLoadingBuyerSpaceChain,
  } = useSpaceDetailsWeb3Rpc({
    spaceId:
      buyerRecipientType === 'space' && buyerSpaceMeta?.web3SpaceId
        ? buyerSpaceMeta.web3SpaceId
        : null,
  });

  const buyerExecutorAddress = buyerSpaceChainDetails?.executor as
    | string
    | undefined;

  const buyerBalanceLookupAddress =
    buyerRecipientType === 'space' && buyerExecutorAddress
      ? buyerExecutorAddress
      : buyerAddress;

  React.useEffect(() => {
    const creatorAddress =
      creator?.address ||
      members.find((member) => member.id === creator?.id)?.address;

    if (sellerRecipientType === 'space') {
      if (currentSpaceAddress && sellerAddress !== currentSpaceAddress) {
        setValue('sellerAddress', currentSpaceAddress, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setValue('sellerRecipientType', 'space', { shouldDirty: true });
      return;
    }

    setValue('sellerRecipientType', 'member', { shouldDirty: true });
    if (creatorAddress && sellerAddress !== creatorAddress) {
      setValue('sellerAddress', creatorAddress, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    creator?.address,
    creator?.id,
    currentSpaceAddress,
    members,
    sellerAddress,
    sellerRecipientType,
    setValue,
  ]);

  React.useEffect(() => {
    setValue('buyerRecipientType', buyerRecipientType, { shouldDirty: true });
  }, [buyerRecipientType, setValue]);

  React.useEffect(() => {
    if (sellerRecipientType === 'space' && spaceExecutorAddress) {
      setValue('spaceExecutorAddress', spaceExecutorAddress, {
        shouldDirty: true,
      });
    } else {
      setValue('spaceExecutorAddress', '', { shouldDirty: true });
    }
  }, [sellerRecipientType, spaceExecutorAddress, setValue]);

  const sellerTokenCandidates = React.useMemo(
    () =>
      (tokens as ExtendedToken[]).filter(
        (token) =>
          token.transferable === true &&
          token.space?.slug === activeSpaceCatalogueSlug,
      ),
    [tokens, activeSpaceCatalogueSlug],
  );

  const { tokens: buyerTokenCandidates, isLoading: isLoadingBuyerTokenList } =
    useWalletTransferableTokens({
      spaceSlug,
      walletAddress: buyerBalanceLookupAddress,
    });

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
      { revalidateOnFocus: true },
    );

  const { data: buyerOwnedTokenSet, isLoading: isLoadingBuyerBalances } =
    useSWR(
      isEvmAddress(buyerBalanceLookupAddress) && buyerTokenCandidates.length
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
      { revalidateOnFocus: true },
    );

  const sellerTokens = React.useMemo(() => {
    if (!isEvmAddress(sellerBalanceLookupAddress) || !sellerOwnedTokenSet)
      return [];
    const matched = sellerTokenCandidates.filter((token) =>
      sellerOwnedTokenSet.has(token.address.toLowerCase()),
    );
    return toPayoutTokens(matched);
  }, [sellerBalanceLookupAddress, sellerOwnedTokenSet, sellerTokenCandidates]);

  const buyerTokens = React.useMemo(() => {
    if (!isEvmAddress(buyerBalanceLookupAddress) || !buyerOwnedTokenSet)
      return [];
    const matched = buyerTokenCandidates.filter((token) =>
      buyerOwnedTokenSet.has(token.address.toLowerCase()),
    );
    return toPayoutTokens(matched);
  }, [buyerBalanceLookupAddress, buyerOwnedTokenSet, buyerTokenCandidates]);

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
        readOnlyDropdown={true}
      />
      <Separator />
      <Skeleton
        loading={
          isLoading ||
          (sellerRecipientType === 'space' && isLoadingActiveSpaceChain) ||
          (isEvmAddress(sellerBalanceLookupAddress) && isLoadingSellerBalances)
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
      <Skeleton
        loading={
          isLoading ||
          isLoadingBuyerTokenList ||
          (buyerRecipientType === 'space' && isLoadingBuyerSpaceChain) ||
          (isEvmAddress(buyerBalanceLookupAddress) && isLoadingBuyerBalances)
        }
        width="100%"
        height={90}
      >
        <TokenPayoutFieldArray
          tokens={buyerTokens}
          name="buyerLeg"
          label={tAgreementFlow(
            'plugins.exchangeStakesAndTokens.buyerWillSend',
          )}
        />
      </Skeleton>
      <p className="text-2 text-neutral-11 max-w-full">
        {tAgreementFlow('plugins.exchangeStakesAndTokens.escrowNotice')}
      </p>
    </div>
  );
};
