'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { PaymentSchedule } from './components/payment-schedule';
import { Separator } from '@hypha-platform/ui';
import { useMembers } from '@web/hooks/use-members';
import { tokens } from '../pay-for-expenses/tokens';

export const ProposeContributionPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
}) => {
  const { members } = useMembers({ spaceSlug });

  return (
    <div className="flex flex-col gap-4">
      <RecipientField recipients={members} />
      <Separator />
      <PaymentSchedule />
      <TokenPayoutFieldArray tokens={tokens} name="payouts" />
    </div>
  );
};
