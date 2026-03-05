'use client';

import {
  Separator,
  Skeleton,
  FormLabel,
  FormField,
  FormItem,
} from '@hypha-platform/ui';
import { useTokens, useTokenSupply } from '../../hooks';
import { useFormContext } from 'react-hook-form';
import { DbToken, Token } from '@hypha-platform/core/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDbTokens } from '../../../hooks';
import { Person, Space } from '@hypha-platform/core/client';
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
import { MaxRedemptionPercentField } from './max-redemption-percent-field';
import { MaxRedemptionPeriodDaysField } from './max-redemption-period-days-field';
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
  const { control, watch, getValues } = useFormContext();
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const filteredTokens = tokens.filter(
    (t: ExtendedToken) => t?.space?.slug === spaceSlug,
  );
  const vault = watch('tokenBackingVault');
  const spaceToken = vault?.spaceToken;
  const activateVault = vault?.activateVault ?? true;
  const enableRedemption = vault?.enableRedemption ?? false;
  const showCollateralSections =
    spaceToken && activateVault && enableRedemption;
  const enableAdvancedControls =
    vault?.enableAdvancedRedemptionControls ?? false;

  const { tokens: dbTokens } = useDbTokens();
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
            <ActivateVaultField />
            <EnableRedemptionField />
          </>
        )}

        {showCollateralSections && (
          <>
            <Separator />
            <AddCollateralsFieldArray filteredTokens={filteredTokens} />
            <RemoveCollateralsFieldArray filteredTokens={filteredTokens} />

            <Separator />
            <div className="flex flex-col gap-4">
              <FormLabel>Set Redemption Price</FormLabel>
              <ReferenceCurrencyField />
              <TokenPriceField />
            </div>

            <MinimumBackingPercentField />
            <MaxRedemptionPercentField />
            <MaxRedemptionPeriodDaysField />
            <RedemptionStartDateField />
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
      </Skeleton>
    </div>
  );
};
