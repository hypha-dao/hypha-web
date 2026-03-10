'use client';

import { Separator } from '@hypha-platform/ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { useDbTokens } from '../../../hooks';
import { useTokenSupply } from '../../hooks';
import {
  TokenSelectionSection,
  TokenPurchaseToggleSection,
  TokenPurchasePriceSection,
  PurchaseEligibilitySection,
} from './components';

type UseDbTokensToken = {
  id: number;
  name: string;
  symbol: string;
  address?: string;
  maxSupply: number;
  type: string;
  referencePrice?: number | null;
  referenceCurrency?: string | null;
  iconUrl?: string | null;
  spaceId?: number;
};

export const SpaceTokenPurchasePlugin = ({
  spaceSlug,
  spaceId,
}: {
  spaceSlug: string;
  spaceId?: number;
}) => {
  const { control } = useFormContext();

  const { tokens: dbTokens, isLoading } = useDbTokens();

  const spaceTokens = (dbTokens as UseDbTokensToken[]).filter(
    (t) =>
      t.type !== 'voice' &&
      t.address &&
      (spaceId != null ? t.spaceId === spaceId : true),
  );

  const tokenAddress = useWatch({ control, name: 'tokenAddress' });

  const selectedToken = spaceTokens.find(
    (t) => t.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const { supply, isLoading: isLoadingSupply } = useTokenSupply(
    selectedToken?.address as `0x${string}` | undefined,
  );

  return (
    <div className="flex flex-col gap-5">
      <TokenSelectionSection
        spaceSlug={spaceSlug}
        spaceTokens={spaceTokens}
        selectedToken={selectedToken}
        isLoading={isLoading}
        isLoadingSupply={isLoadingSupply}
        supply={supply}
      />

      <Separator />

      <TokenPurchaseToggleSection />

      <Separator />

      <TokenPurchasePriceSection
        selectedToken={selectedToken}
        supply={supply}
      />

      <Separator />

      <PurchaseEligibilitySection selectedToken={selectedToken} />
    </div>
  );
};
