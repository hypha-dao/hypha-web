'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
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
  const t = useTranslations('AgreementFlow.plugins.acceptInvestment');

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
    </div>
  );
};
