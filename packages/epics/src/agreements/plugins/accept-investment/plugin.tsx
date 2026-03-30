'use client';

import React from 'react';
import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';

export const AcceptInvestmentPlugin = ({
  spaceSlug,
  members,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const { watch, setValue } = useFormContext();
  const t = useTranslations('AgreementFlow.plugins.acceptInvestment');

  const sendLeg0 = watch('investorSendLegs.0');
  const receiveLeg0 = watch('spaceReceiveLegs.0');

  React.useEffect(() => {
    if (
      receiveLeg0 &&
      typeof receiveLeg0 === 'object' &&
      receiveLeg0.amount === '' &&
      receiveLeg0.token === '' &&
      sendLeg0 &&
      typeof sendLeg0 === 'object' &&
      (sendLeg0.amount !== '' || sendLeg0.token !== '')
    ) {
      setValue(
        'spaceReceiveLegs.0',
        {
          amount: sendLeg0.amount ?? '',
          token: sendLeg0.token ?? ('' as `0x${string}`),
        },
        { shouldValidate: false },
      );
    }
  }, [sendLeg0?.amount, sendLeg0?.token, receiveLeg0, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        label={t('investingMember')}
      />
      <Separator />
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray
          tokens={tokens}
          name="investorSendLegs"
          label={t('investorWillSend')}
          allowAddOrRemove={false}
        />
      </Skeleton>
      <Separator />
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray
          tokens={tokens}
          name="spaceReceiveLegs"
          label={t('investorWillReceive')}
          allowAddOrRemove={false}
        />
      </Skeleton>
    </div>
  );
};
