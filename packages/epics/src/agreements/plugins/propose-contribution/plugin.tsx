'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { PaymentSchedule } from './components/payment-schedule';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { useTokens } from '@hypha-platform/epics';
import { Person } from '@core/people';

export const ProposeContributionPlugin = ({
  spaceSlug,
  members,
}: {
  spaceSlug: string;
  members: Person[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  return (
    <div className="flex flex-col gap-4">
      <RecipientField recipients={members} />
      <Separator />
      <PaymentSchedule />
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray tokens={tokens} name="payouts" />
      </Skeleton>
    </div>
  );
};
