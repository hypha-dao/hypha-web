'use client';

import {
  Separator,
  Skeleton,
  FormLabel,
  FormField,
  FormItem,
} from '@hypha-platform/ui';
import { useTokens, useTokenSupply, useVaults } from '../../hooks';
import { useFormContext } from 'react-hook-form';
import {
  CURRENCY_FEED_OPTIONS,
  DbToken,
  Token,
} from '@hypha-platform/core/client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useDbTokens } from '../../../hooks';
import { Person, Space } from '@hypha-platform/core/client';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import React from 'react';
import { TransferWhitelistFieldArray } from '../../components/common/transfer-whitelist-field-array';
import { SpaceTokenField } from './space-token-field';
import { TokenSupplySection } from './token-supply-section';
import { ActivateVaultField } from './activate-vault-field';
import { EnableRedemptionField } from './enable-redemption-field';
import { AddCollateralsFieldArray } from './add-collaterals-field-array';
import { RemoveCollateralsFieldArray } from './remove-collaterals-field-array';
import { ReferenceCurrencyField } from './reference-currency-field';
import { TokenPriceField } from './token-price-field';
import { MinimumBackingPercentField } from './minimum-backing-percent-field';
import { MaxRedemptionField } from './max-redemption-field';
import { RedemptionStartDateField } from './redemption-start-date-field';
import { EnableAdvancedRedemptionControlsField } from './enable-advanced-redemption-controls-field';

interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

type TokenBackingVaultPluginProps = {
  spaceSlug: string;
  members?: Person[];
  spaces?: Space[];
};

export const TokenBackingVaultPlugin = ({
  spaceSlug,
  members = [],
  spaces = [],
}: TokenBackingVaultPluginProps) => {
  const { lang } = useParams();
  const searchParams = useSearchParams();
  const { control, watch, getValues, setValue } = useFormContext();
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const filteredTokens = tokens.filter(
    (t: ExtendedToken) => t?.space?.slug === spaceSlug,
  );
  const vault = watch('tokenBackingVault');
  const spaceToken = vault?.spaceToken;
  const activateVault = vault?.activateVault ?? true;
  const enableRedemption = vault?.enableRedemption ?? false;
  const showCollateralSections = spaceToken && activateVault;
  const showRedemptionSections =
    spaceToken && activateVault && enableRedemption;
  const enableAdvancedControls =
    vault?.enableAdvancedRedemptionControls ?? false;

  const { tokens: dbTokens } = useDbTokens();
  const { vaults, isLoading: isLoadingVaults } = useVaults();
  const selectedToken = dbTokens
    .filter((t: DbToken) => t.address)
    .find(
      (t: DbToken) =>
        t.address?.toLowerCase() ===
        getValues('tokenBackingVault.spaceToken')?.toLowerCase(),
    );
  const { supply, isLoading: isLoadingSupply } = useTokenSupply(
    selectedToken?.address as `0x${string}`,
  );
  const currentVault = spaceToken
    ? vaults.find(
        (v) => v.spaceToken.toLowerCase() === spaceToken.toLowerCase(),
      )
    : undefined;
  const presetTokenRef = React.useRef<string | null>(null);
  const prefilledTokenRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const requestedSpaceToken = searchParams.get('spaceToken');
    if (!requestedSpaceToken) return;
    if (presetTokenRef.current === requestedSpaceToken.toLowerCase()) return;
    const hasMatchingToken = filteredTokens.some(
      (token: ExtendedToken) =>
        token.address?.toLowerCase() === requestedSpaceToken.toLowerCase(),
    );
    if (!hasMatchingToken) return;

    setValue('tokenBackingVault.spaceToken', requestedSpaceToken, {
      shouldDirty: false,
      shouldTouch: false,
    });
    presetTokenRef.current = requestedSpaceToken.toLowerCase();
  }, [searchParams, filteredTokens, setValue]);

  React.useEffect(() => {
    if (!spaceToken) {
      prefilledTokenRef.current = undefined;
      return;
    }
    if (isLoadingVaults) return;

    const normalizedToken = spaceToken.toLowerCase();
    if (prefilledTokenRef.current === normalizedToken) return;

    if (!currentVault) {
      setValue('tokenBackingVault.activateVault', true, { shouldDirty: false });
      setValue('tokenBackingVault.enableRedemption', false, {
        shouldDirty: false,
      });
      setValue(
        'tokenBackingVault.referenceCurrency',
        CURRENCY_FEED_OPTIONS[0].value,
        { shouldDirty: false },
      );
      setValue('tokenBackingVault.tokenPrice', undefined, {
        shouldDirty: false,
      });
      setValue('tokenBackingVault.minimumBackingPercent', undefined, {
        shouldDirty: false,
      });
      setValue('tokenBackingVault.maxRedemptionPercent', undefined, {
        shouldDirty: false,
      });
      setValue('tokenBackingVault.maxRedemptionPeriodDays', undefined, {
        shouldDirty: false,
      });
      setValue('tokenBackingVault.redemptionStartDate', null, {
        shouldDirty: false,
      });
      setValue('tokenBackingVault.enableAdvancedRedemptionControls', false, {
        shouldDirty: false,
      });
      setValue('tokenBackingVault.redemptionWhitelist', [], {
        shouldDirty: false,
      });
      prefilledTokenRef.current = normalizedToken;
      return;
    }

    const parsedStartDate = currentVault.redemptionStartDate
      ? new Date(currentVault.redemptionStartDate)
      : null;
    const validStartDate =
      parsedStartDate instanceof Date &&
      !Number.isNaN(parsedStartDate.getTime())
        ? parsedStartDate
        : null;

    setValue('tokenBackingVault.activateVault', true, { shouldDirty: false });
    setValue(
      'tokenBackingVault.enableRedemption',
      Boolean(currentVault.redemptionEnabled),
      { shouldDirty: false },
    );
    setValue(
      'tokenBackingVault.referenceCurrency',
      currentVault.redemptionCurrencyFeed ?? CURRENCY_FEED_OPTIONS[0].value,
      { shouldDirty: false },
    );
    setValue(
      'tokenBackingVault.tokenPrice',
      currentVault.redemptionPrice !== undefined &&
        currentVault.redemptionPrice > 0
        ? String(currentVault.redemptionPrice)
        : undefined,
      { shouldDirty: false },
    );
    setValue(
      'tokenBackingVault.minimumBackingPercent',
      currentVault.minimumBackingPercent,
      { shouldDirty: false },
    );
    setValue(
      'tokenBackingVault.maxRedemptionPercent',
      currentVault.maxRedemptionPercent,
      { shouldDirty: false },
    );
    setValue(
      'tokenBackingVault.maxRedemptionPeriodDays',
      currentVault.maxRedemptionPeriodDays,
      { shouldDirty: false },
    );
    setValue('tokenBackingVault.redemptionStartDate', validStartDate, {
      shouldDirty: false,
    });
    setValue(
      'tokenBackingVault.enableAdvancedRedemptionControls',
      Boolean(currentVault.whitelistEnabled),
      { shouldDirty: false },
    );
    prefilledTokenRef.current = normalizedToken;
  }, [spaceToken, currentVault, isLoadingVaults, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isLoading} width="100%" height={90}>
        <div className="flex flex-col gap-4">
          <FormLabel>Token Backing Vault</FormLabel>
          <span className="text-2 text-neutral-11">
            Create a token backing vault, define redemption rules and
            restrictions, set the start date and redemption price.
          </span>
        </div>

        <SpaceTokenField filteredTokens={filteredTokens} />

        {filteredTokens.length === 0 && (
          <div className="text-2 text-foreground">
            Your space has not yet created a token,{' '}
            <Link
              href={`/${lang}/dho/${spaceSlug}/agreements/create/issue-new-token`}
              className="text-accent-9 underline"
              onClick={(e) => e.stopPropagation()}
            >
              click here
            </Link>{' '}
            to first issue a token
          </div>
        )}

        {spaceToken && (
          <>
            <TokenSupplySection
              maxSupply={selectedToken?.maxSupply as number}
              supply={supply}
              isLoadingSupply={isLoadingSupply}
            />
            {currentVault && currentVault.collaterals.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-2 text-neutral-11">
                  Current Backing Collaterals
                </div>
                {currentVault.collaterals.map((collateral, i) => (
                  <div
                    key={`${collateral.address}-${i}`}
                    className="flex justify-between items-center text-1"
                  >
                    <div className="flex items-center gap-2">
                      {collateral.icon && (
                        <img
                          src={collateral.icon}
                          alt={collateral.symbol}
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      <span>{collateral.symbol}</span>
                    </div>
                    <span>
                      {formatCurrencyValue(collateral.value)}{' '}
                      {collateral.symbol}
                      {collateral.usdEqual > 0 && (
                        <span className="text-neutral-9 ml-1">
                          (${formatCurrencyValue(collateral.usdEqual)})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <ActivateVaultField />
            {showCollateralSections && (
              <>
                <Separator />
                <AddCollateralsFieldArray filteredTokens={filteredTokens} />
                <RemoveCollateralsFieldArray filteredTokens={filteredTokens} />
              </>
            )}
            <EnableRedemptionField />
            {showRedemptionSections && (
              <>
                <Separator />
                <div className="flex flex-col gap-4">
                  <FormLabel>Set Redemption Price</FormLabel>
                  <ReferenceCurrencyField isRequired />
                  <TokenPriceField
                    tokenReferencePrice={selectedToken?.referencePrice}
                    tokenReferenceCurrency={selectedToken?.referenceCurrency}
                    isRequired
                  />
                </div>

                <MinimumBackingPercentField isRequired />
                <MaxRedemptionField isRequired />
                <RedemptionStartDateField isRequired />
                <EnableAdvancedRedemptionControlsField />

                {enableAdvancedControls && (
                  <FormField
                    control={control}
                    name="tokenBackingVault.redemptionWhitelist"
                    render={() => (
                      <FormItem>
                        <TransferWhitelistFieldArray
                          name="tokenBackingVault.redemptionWhitelist"
                          label="Redemption Whitelist"
                          description="Specify which members or spaces are authorised to redeem tokens."
                          members={members}
                          spaces={spaces}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
          </>
        )}
      </Skeleton>
    </div>
  );
};
