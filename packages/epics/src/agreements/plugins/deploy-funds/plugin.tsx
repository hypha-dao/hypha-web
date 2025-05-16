'use client';

import { useMembers } from '@web/hooks/use-members';
import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator } from '@hypha-platform/ui';
import { tokens } from '../pay-for-expenses/tokens';

export const DeployFundsPlugin = ({ spaceSlug }: { spaceSlug: string }) => {
  const { members } = useMembers({ spaceSlug });

  return (
    <div className="flex flex-col gap-4">
      <RecipientField recipients={members} />
      <Separator />
      <TokenPayoutFieldArray tokens={tokens} name="payouts" />
    </div>
  );
};
