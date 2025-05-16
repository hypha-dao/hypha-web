'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator } from '@hypha-platform/ui';
import { useTokens } from '../hooks';

export const PayForExpensesPlugin = () => {
  const { tokens } = useTokens();
  return (
    <div className="flex flex-col gap-4">
      <RecipientField />
      <Separator />
      <TokenPayoutFieldArray tokens={tokens} name="payouts" />
    </div>
  );
};
