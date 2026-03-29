'use client';

import { Separator } from '@hypha-platform/ui';
import { useFormContext, useWatch } from 'react-hook-form';
import React from 'react';
import useSWR from 'swr';
import { useDbTokens } from '../../../hooks';
import { useTokenSupply } from '../../hooks';
import {
  getBalance,
  useSpaceDetailsWeb3Rpc,
  useSpaceTokenSaleDetailsFromChain,
} from '@hypha-platform/core/client';
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
  web3SpaceId,
}: {
  spaceSlug: string;
  spaceId?: number;
  web3SpaceId?: number | null;
}) => {
  const { control, setValue } = useFormContext();

  const { tokens: dbTokens, isLoading } = useDbTokens();

  const spaceTokens = (dbTokens as UseDbTokensToken[]).filter(
    (t) =>
      t.type !== 'voice' &&
      t.address &&
      (spaceId != null ? t.spaceId === spaceId : true),
  );

  const tokenAddress = useWatch({ control, name: 'tokenAddress' });
  const activatePurchase =
    useWatch({ control, name: 'activatePurchase' }) ?? false;

  const hydratedFromChainForToken = React.useRef<string | null>(null);

  const tokenAddressChecksum = tokenAddress as `0x${string}` | undefined;

  const { data: saleDetailsFromChain } = useSpaceTokenSaleDetailsFromChain({
    tokenAddress: tokenAddressChecksum,
    enabled: Boolean(tokenAddressChecksum),
  });

  React.useEffect(() => {
    hydratedFromChainForToken.current = null;
  }, [tokenAddressChecksum]);

  React.useEffect(() => {
    if (!tokenAddressChecksum || saleDetailsFromChain === undefined) {
      return;
    }
    if (
      saleDetailsFromChain.queriedTokenAddress.toLowerCase() !==
      tokenAddressChecksum.toLowerCase()
    ) {
      return;
    }
    if (hydratedFromChainForToken.current === tokenAddressChecksum) {
      return;
    }

    setValue('activatePurchase', saleDetailsFromChain.activatePurchase, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (saleDetailsFromChain.activatePurchase) {
      if (saleDetailsFromChain.purchasePrice !== undefined) {
        setValue('purchasePrice', saleDetailsFromChain.purchasePrice, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (saleDetailsFromChain.purchaseCurrency !== undefined) {
        setValue('purchaseCurrency', saleDetailsFromChain.purchaseCurrency, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (saleDetailsFromChain.tokensAvailableForPurchase !== undefined) {
        setValue(
          'tokensAvailableForPurchase',
          saleDetailsFromChain.tokensAvailableForPurchase,
          {
            shouldDirty: true,
            shouldValidate: true,
          },
        );
      }
    }

    hydratedFromChainForToken.current = tokenAddressChecksum;
  }, [tokenAddressChecksum, saleDetailsFromChain, setValue]);

  const selectedToken = spaceTokens.find(
    (t) => t.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const { supply, isLoading: isLoadingSupply } = useTokenSupply(
    selectedToken?.address as `0x${string}` | undefined,
  );
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });
  const treasuryAddress = spaceDetails?.executor as `0x${string}` | undefined;

  const { data: treasuryBalanceData, isLoading: isLoadingTreasuryBalance } =
    useSWR(
      selectedToken?.address && treasuryAddress
        ? ['spaceTokenTreasuryBalance', selectedToken.address, treasuryAddress]
        : null,
      async ([, tokenAddress, ownerAddress]) =>
        getBalance(
          tokenAddress as `0x${string}`,
          ownerAddress as `0x${string}`,
        ),
      { revalidateOnFocus: true },
    );

  const treasuryBalance = treasuryBalanceData?.amount;

  return (
    <div className="flex flex-col gap-5">
      <TokenSelectionSection
        spaceSlug={spaceSlug}
        spaceTokens={spaceTokens}
        selectedToken={selectedToken}
        isLoading={isLoading}
        isLoadingSupply={isLoadingSupply}
        isLoadingTreasuryBalance={isLoadingTreasuryBalance}
        supply={supply}
        treasuryBalance={treasuryBalance}
      />

      <Separator />

      <TokenPurchaseToggleSection />

      {activatePurchase && (
        <>
          <Separator />

          <TokenPurchasePriceSection
            selectedToken={selectedToken}
            supply={supply}
          />

          <Separator />

          <PurchaseEligibilitySection selectedToken={selectedToken} />
        </>
      )}
    </div>
  );
};
