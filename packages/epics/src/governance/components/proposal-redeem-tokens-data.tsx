'use client';

import {
  bigIntToPercentageString,
  useSpacesByWeb3Ids,
  useTokenDecimals,
} from '@hypha-platform/core/client';
import React from 'react';
import { formatUnits } from 'viem';
import { AssetItem, useTokens } from '../../treasury';

export interface ProposalRedeemTokensDataProps {
  amount?: bigint;
  token?: `0x${string}`;
  web3SpaceId?: bigint;
  conversions: {
    asset?: `0x${string}`;
    percentage?: bigint;
  }[];
}

export const ProposalRedeemTokensData = ({
  amount,
  token,
  web3SpaceId,
  conversions,
}: ProposalRedeemTokensDataProps) => {
  const { decimals } = useTokenDecimals(token);
  const { spaces } = useSpacesByWeb3Ids(web3SpaceId ? [web3SpaceId] : []);
  const spaceSlug = React.useMemo(() => spaces?.[0]?.slug ?? '', [spaces]);
  const { tokens: tokenList } = useTokens({ spaceSlug });
  const tokenLabel = React.useCallback(
    (tokenAddress: string) => {
      return (
        tokenList.find((t: AssetItem) => t.address === tokenAddress)?.symbol ??
        tokenAddress
      );
    },
    [tokenList],
  );
  const amountView = React.useMemo(() => {
    if (amount === undefined || decimals === undefined) return null;
    return formatUnits(amount, decimals);
  }, [amount, decimals]);

  return (
    <div className="flex flex-col gap-4">
      {amountView && (
        <div className="flex flex-row text-1 text-neutral-11 w-full">
          Redemption Amount: {amountView} {tokenLabel(token ?? '')}
        </div>
      )}
      <div className="flex flex-row text-1 text-neutral-11 w-full">
        Conversions:
      </div>
      {conversions.map((conversion) => (
        <div
          key={conversion.asset}
          className="flex flex-row text-1 text-neutral-11 w-full"
        >
          {tokenLabel(conversion.asset ?? '')}:{' '}
          {conversion.percentage
            ? bigIntToPercentageString(conversion.percentage)
            : 0}
          %
        </div>
      ))}
    </div>
  );
};
