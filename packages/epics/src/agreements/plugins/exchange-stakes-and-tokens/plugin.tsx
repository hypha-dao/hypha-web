'use client';

import { RecipientField } from '../components/common/recipient-field';
import { RecipientType } from '../components/common/recipient';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import {
  Person,
  Space,
  Token,
  getBalance,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';
import React from 'react';
import useSWR from 'swr';
import { useFormContext, useWatch } from 'react-hook-form';
import { useParams } from 'next/navigation';

const isEvmAddress = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

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
  const { control, setValue } = useFormContext();
  const params = useParams();
  const currentSpaceSlug = params.id as string;
  const { space: activeSpace } = useSpaceBySlug(currentSpaceSlug);
  const { person: creator } = useMe();
  const [sellerRecipientType, setSellerRecipientType] =
    React.useState<RecipientType>('member');
  const currentSpaceAddress = activeSpace?.address ?? undefined;
  const sellerAddress = useWatch({ control, name: 'sellerAddress' }) as
    | string
    | undefined;
  const buyerAddress = useWatch({ control, name: 'buyerAddress' }) as
    | string
    | undefined;
  const { tokens, isLoading } = useTokens({ spaceSlug });

  const sellerSpaces = React.useMemo(() => {
    if (!activeSpace?.address) return spaces;
    if (!spaces?.length) return [activeSpace];
    const hasActiveSpace = spaces.some(
      (space) =>
        space.address?.toLowerCase() === activeSpace.address?.toLowerCase(),
    );
    return hasActiveSpace ? spaces : [activeSpace, ...spaces];
  }, [activeSpace, spaces]);

  React.useEffect(() => {
    const creatorAddress =
      creator?.address ||
      members.find((member) => member.id === creator?.id)?.address;
    const nextSellerAddress =
      sellerRecipientType === 'space' ? currentSpaceAddress : creatorAddress;

    if (nextSellerAddress && sellerAddress !== nextSellerAddress) {
      setValue('sellerAddress', nextSellerAddress, {
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

  const sellerTokenCandidates = React.useMemo(
    () => tokens.filter((token: Token) => token.type !== null),
    [tokens],
  );
  const buyerTokenCandidates = React.useMemo(
    () =>
      tokens.filter(
        (token: Token) => token.type === null || token.type === 'utility',
      ),
    [tokens],
  );

  const { data: sellerOwnedTokenSet, isLoading: isLoadingSellerBalances } =
    useSWR(
      isEvmAddress(sellerAddress) && sellerTokenCandidates.length
        ? [
            'exchangeSellerOwnedTokens',
            sellerAddress,
            ...sellerTokenCandidates.map((token: Token) =>
              token.address.toLowerCase(),
            ),
          ]
        : null,
      async () => {
        const balances = await Promise.allSettled(
          sellerTokenCandidates.map(async (token: Token) => {
            const { amount } = await getBalance(
              token.address as `0x${string}`,
              sellerAddress as `0x${string}`,
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
      isEvmAddress(buyerAddress) && buyerTokenCandidates.length
        ? [
            'exchangeBuyerOwnedTokens',
            buyerAddress,
            ...buyerTokenCandidates.map((token: Token) =>
              token.address.toLowerCase(),
            ),
          ]
        : null,
      async () => {
        const balances = await Promise.allSettled(
          buyerTokenCandidates.map(async (token: Token) => {
            const { amount } = await getBalance(
              token.address as `0x${string}`,
              buyerAddress as `0x${string}`,
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
    if (!isEvmAddress(sellerAddress) || !sellerOwnedTokenSet) return [];
    return sellerTokenCandidates.filter((token: Token) =>
      sellerOwnedTokenSet.has(token.address.toLowerCase()),
    );
  }, [sellerAddress, sellerOwnedTokenSet, sellerTokenCandidates]);

  const buyerTokens = React.useMemo(() => {
    if (!isEvmAddress(buyerAddress) || !buyerOwnedTokenSet) return [];
    return buyerTokenCandidates.filter((token: Token) =>
      buyerOwnedTokenSet.has(token.address.toLowerCase()),
    );
  }, [buyerAddress, buyerOwnedTokenSet, buyerTokenCandidates]);

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
          isLoading || (isEvmAddress(sellerAddress) && isLoadingSellerBalances)
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
        spaces={spaces}
        defaultRecipientType="member"
        label={tAgreementFlow('plugins.exchangeStakesAndTokens.buyer')}
        name="buyerAddress"
      />
      <Separator />
      <Skeleton
        loading={
          isLoading || (isEvmAddress(buyerAddress) && isLoadingBuyerBalances)
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
    </div>
  );
};
