'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator } from '@hypha-platform/ui';
import { useTokens } from '@hypha-platform/epics';
import { Person } from '@core/people';

export const PayForExpensesPlugin = ({
  spaceSlug,
  members,
}: {
  spaceSlug: string;
  members: Person[];
}) => {
  const { tokens } = useTokens();
  return (
    <div className="flex flex-col gap-4">
      <RecipientField recipients={members} />
      <Separator />
      <TokenPayoutFieldArray tokens={tokens} name="payouts" />
    </div>
  );
};
