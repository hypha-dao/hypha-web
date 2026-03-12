'use client';

import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { TokenPercentageFieldArray } from '../components/common/token-percentage-field-array';
import { Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useAssets, useTokens } from '../../../treasury';

export const RedeemTokensPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const { tokens, isLoading: isTokensLoading } = useTokens({ spaceSlug });
  const { assets, isLoading: isAssetsLoading } = useAssets({});

  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isTokensLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray
          tokens={tokens}
          name="redemptions"
          label="Redemption Amount"
          allowAddOrRemove={false}
        />
      </Skeleton>
      <Skeleton loading={isAssetsLoading} width={'100%'} height={90}>
        <TokenPercentageFieldArray
          assets={assets}
          name="conversions"
          label="Converted into"
        />
      </Skeleton>
    </div>
  );
};
