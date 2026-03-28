'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { RequirementMark, Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';

export const PayForExpensesPlugin = ({
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
  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="space"
      />
      <Separator />
      <h3 className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.tokenPayoutFieldArray.paymentRequest')}{' '}
        <RequirementMark />
      </h3>
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray
          tokens={tokens}
          name="payouts"
          showInlineLabel={false}
        />
      </Skeleton>
    </div>
  );
};
