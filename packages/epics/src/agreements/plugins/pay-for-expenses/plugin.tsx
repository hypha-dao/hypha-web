'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';

export const PayForExpensesPlugin = ({
  spaceSlug,
  members,
  subspaces,
}: {
  spaceSlug: string;
  members: Person[];
  subspaces?: Space[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  return (
    <div className="flex flex-col gap-4">
      <RecipientField members={members} subspaces={subspaces} />
      <Separator />
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray tokens={tokens} name="payouts" />
      </Skeleton>
    </div>
  );
};
