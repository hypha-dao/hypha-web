'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space, Token } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';
import React from 'react';

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
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const sellerTokens = React.useMemo(
    () => tokens.filter((token: Token) => token.type !== null),
    [tokens],
  );
  const buyerTokens = React.useMemo(
    () =>
      tokens.filter(
        (token: Token) => token.type === null || token.type === 'utility',
      ),
    [tokens],
  );

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
      <Skeleton loading={isLoading} width="100%" height={90}>
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
      <Skeleton loading={isLoading} width="100%" height={90}>
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
