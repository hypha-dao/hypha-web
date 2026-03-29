'use client';

import { CURRENCY_FEED_OPTIONS } from '@hypha-platform/core/client';
import type { DbToken } from '@hypha-platform/core/client';
import { EthAddress } from '../../../people';
import { useTokens, useVaults } from '../../../treasury';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useFormatter, useTranslations } from 'next-intl';
import { getTokenSymbol } from './get-token-symbol';
import { TokenBackingVaultDetailRow } from './token-backing-vault-detail-row';
import { TokenBackingVaultAddCollaterals } from './token-backing-vault-add-collaterals';
import { TokenBackingVaultRemoveCollaterals } from './token-backing-vault-remove-collaterals';
import { TokenBackingVaultWhitelist } from './token-backing-vault-whitelist';

const CURRENCY_FEED_BY_ADDRESS = Object.fromEntries(
  CURRENCY_FEED_OPTIONS.map((opt) => [opt.value.toLowerCase(), opt.label]),
);

const formatCompactNumber = (value: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return numeric.toString();
};

interface ProposalTokenBackingVaultDataProps {
  spaceSlug: string;
  dbTokens?: DbToken[];
  /** When set (e.g. redeem proposal above), hide space token + live vault collateral list as duplicates. */
  suppressRedeemDuplicates?: boolean;
  spaceToken?: string;
  addCollaterals?: Array<{ token: string; amount: string; decimals: number }>;
  removeCollaterals?: Array<{ token: string; amount: string }>;
  enableRedemption?: boolean;
  redemptionStartDate?: Date;
  redemptionPrice?: string;
  currencyFeed?: string;
  maxRedemptionPercent?: number;
  maxRedemptionPeriodDays?: number;
  minimumBackingPercent?: number;
  whitelistEnabled?: boolean;
  whitelistedAddresses?: string[];
}

export function ProposalTokenBackingVaultData({
  spaceSlug,
  dbTokens = [],
  suppressRedeemDuplicates = false,
  spaceToken,
  addCollaterals,
  removeCollaterals,
  enableRedemption,
  redemptionStartDate,
  redemptionPrice,
  currencyFeed,
  maxRedemptionPercent,
  maxRedemptionPeriodDays,
  minimumBackingPercent,
  whitelistEnabled,
  whitelistedAddresses,
}: ProposalTokenBackingVaultDataProps) {
  const tProposalDetails = useTranslations('ProposalDetails');
  const format = useFormatter();
  const { tokens: spaceTokens } = useTokens({ spaceSlug });
  const { vaults } = useVaults();
  const currencyLabel =
    currencyFeed &&
    (CURRENCY_FEED_BY_ADDRESS[currencyFeed.toLowerCase()] ?? 'USD');

  const currentVault = spaceToken
    ? vaults.find(
        (v) => v.spaceToken.toLowerCase() === spaceToken.toLowerCase(),
      )
    : undefined;

  const showSpaceTokenRow = Boolean(spaceToken) && !suppressRedeemDuplicates;
  const showCurrentBackingCollaterals =
    Boolean(currentVault && currentVault.collaterals.length > 0) &&
    !suppressRedeemDuplicates;

  const hasMeaningfulRedemptionPrice =
    redemptionPrice !== undefined && String(redemptionPrice).trim() !== '';

  const hasMaxRedemptionRow =
    maxRedemptionPercent !== undefined && maxRedemptionPeriodDays !== undefined;

  const hasVaultConfigRows =
    (addCollaterals?.length ?? 0) > 0 ||
    (removeCollaterals?.length ?? 0) > 0 ||
    enableRedemption !== undefined ||
    Boolean(redemptionStartDate) ||
    hasMeaningfulRedemptionPrice ||
    hasMaxRedemptionRow ||
    minimumBackingPercent !== undefined ||
    whitelistEnabled !== undefined ||
    (whitelistedAddresses?.length ?? 0) > 0;

  const hasVisibleContent =
    showSpaceTokenRow || showCurrentBackingCollaterals || hasVaultConfigRows;

  if (!hasVisibleContent) return null;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">
        {tProposalDetails('labels.tokenBackingVault')}
      </span>
      <div className="flex flex-col gap-5">
        {showSpaceTokenRow && (
          <TokenBackingVaultDetailRow
            label={tProposalDetails('labels.spaceToken')}
            value={
              getTokenSymbol(spaceToken!, dbTokens, spaceTokens) || (
                <EthAddress address={spaceToken!} />
              )
            }
          />
        )}
        {showCurrentBackingCollaterals && currentVault && (
          <div className="flex flex-col gap-2">
            <div className="text-1 text-neutral-11">
              {tProposalDetails('labels.currentBackingCollaterals')}
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
                  {formatCurrencyValue(collateral.value)} {collateral.symbol}
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
        {addCollaterals && addCollaterals.length > 0 && (
          <TokenBackingVaultAddCollaterals
            collaterals={addCollaterals}
            dbTokens={dbTokens}
            spaceTokens={spaceTokens}
          />
        )}
        {removeCollaterals && removeCollaterals.length > 0 && (
          <TokenBackingVaultRemoveCollaterals
            collaterals={removeCollaterals}
            dbTokens={dbTokens}
            spaceTokens={spaceTokens}
          />
        )}
        {enableRedemption !== undefined && (
          <TokenBackingVaultDetailRow
            label={tProposalDetails('labels.redemptionEnabled')}
            value={
              enableRedemption
                ? tProposalDetails('labels.yes')
                : tProposalDetails('labels.no')
            }
          />
        )}
        {redemptionStartDate && (
          <TokenBackingVaultDetailRow
            label={tProposalDetails('labels.redemptionStartDate')}
            value={format.dateTime(redemptionStartDate, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        )}
        {hasMeaningfulRedemptionPrice && (
          <TokenBackingVaultDetailRow
            label={tProposalDetails('labels.redemptionPrice')}
            value={`${formatCompactNumber(String(redemptionPrice))} ${
              currencyLabel ?? 'USD'
            }`}
          />
        )}
        {hasMaxRedemptionRow && (
          <TokenBackingVaultDetailRow
            label={tProposalDetails('labels.maxRedemption')}
            value={tProposalDetails('labels.maxRedemptionValue', {
              percent: maxRedemptionPercent,
              days: maxRedemptionPeriodDays,
            })}
          />
        )}
        {minimumBackingPercent !== undefined && (
          <TokenBackingVaultDetailRow
            label={tProposalDetails('labels.minimumBackingPercent')}
            value={`${minimumBackingPercent}%`}
          />
        )}
        {whitelistEnabled !== undefined &&
          whitelistEnabled &&
          whitelistedAddresses &&
          whitelistedAddresses.length > 0 && (
            <TokenBackingVaultWhitelist addresses={whitelistedAddresses} />
          )}
      </div>
    </div>
  );
}
