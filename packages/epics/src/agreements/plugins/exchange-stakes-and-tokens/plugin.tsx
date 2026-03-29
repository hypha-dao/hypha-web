'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space, Token, getBalance } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';
import React from 'react';
import useSWR from 'swr';
import { useFormContext, useWatch } from 'react-hook-form';

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
  const { control } = useFormContext();
  const sellerAddress = useWatch({ control, name: 'sellerAddress' }) as
    | string
    | undefined;
  const buyerAddress = useWatch({ control, name: 'buyerAddress' }) as
    | string
    | undefined;
  const { tokens, isLoading } = useTokens({ spaceSlug });

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
        spaces={spaces}
        defaultRecipientType="member"
        label={tAgreementFlow('plugins.exchangeStakesAndTokens.seller')}
        name="sellerAddress"
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
