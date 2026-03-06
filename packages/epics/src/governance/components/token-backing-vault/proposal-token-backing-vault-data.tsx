'use client';

import { CURRENCY_FEED_OPTIONS } from '@hypha-platform/core/client';
import type { DbToken } from '@hypha-platform/core/client';
import { EthAddress } from '../../../people';
import { useTokens } from '../../../treasury';
import { formatDate } from '@hypha-platform/ui-utils';
import { getTokenSymbol } from './get-token-symbol';
import { TokenBackingVaultDetailRow } from './token-backing-vault-detail-row';
import { TokenBackingVaultAddCollaterals } from './token-backing-vault-add-collaterals';
import { TokenBackingVaultRemoveCollaterals } from './token-backing-vault-remove-collaterals';
import { TokenBackingVaultWhitelist } from './token-backing-vault-whitelist';

const CURRENCY_FEED_BY_ADDRESS = Object.fromEntries(
  CURRENCY_FEED_OPTIONS.map((opt) => [opt.value.toLowerCase(), opt.label]),
);

interface ProposalTokenBackingVaultDataProps {
  spaceSlug: string;
  dbTokens?: DbToken[];
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
  const { tokens: spaceTokens } = useTokens({ spaceSlug });
  const currencyLabel =
    currencyFeed &&
    (CURRENCY_FEED_BY_ADDRESS[currencyFeed.toLowerCase()] ?? 'USD');

  const hasData =
    spaceToken ||
    (addCollaterals?.length ?? 0) > 0 ||
    (removeCollaterals?.length ?? 0) > 0 ||
    enableRedemption !== undefined ||
    redemptionStartDate ||
    redemptionPrice ||
    maxRedemptionPercent !== undefined ||
    minimumBackingPercent !== undefined ||
    whitelistEnabled !== undefined ||
    (whitelistedAddresses?.length ?? 0) > 0;

  if (!hasData) return null;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">
        Token Backing Vault
      </span>
      <div className="flex flex-col gap-5">
        {spaceToken && (
          <TokenBackingVaultDetailRow
            label="Space Token"
            value={
              getTokenSymbol(spaceToken, dbTokens, spaceTokens) || (
                <EthAddress address={spaceToken} />
              )
            }
          />
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
            label="Redemption Enabled"
            value={enableRedemption ? 'Yes' : 'No'}
          />
        )}
        {redemptionStartDate && (
          <TokenBackingVaultDetailRow
            label="Redemption Start Date"
            value={formatDate(redemptionStartDate, true)}
          />
        )}
        {redemptionPrice && (
          <TokenBackingVaultDetailRow
            label="Redemption Price"
            value={`${redemptionPrice} ${currencyLabel}`}
          />
        )}
        {maxRedemptionPercent !== undefined &&
          maxRedemptionPeriodDays !== undefined && (
            <TokenBackingVaultDetailRow
              label="Max Redemption"
              value={`${maxRedemptionPercent}% over ${maxRedemptionPeriodDays} days`}
            />
          )}
        {minimumBackingPercent !== undefined && (
          <TokenBackingVaultDetailRow
            label="Minimum Backing"
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
