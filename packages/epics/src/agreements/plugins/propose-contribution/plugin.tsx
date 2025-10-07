'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { PaymentSchedule } from './components/payment-schedule';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';

export const ProposeContributionPlugin = ({
  spaceSlug,
  members,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        emptySpacesMessage="No member spaces found."
      />
      <Separator />
      <PaymentSchedule />
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray tokens={tokens} name="payouts" />
      </Skeleton>
    </div>
  );
};
