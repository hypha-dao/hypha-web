'use client';

import type { DbToken } from '@hypha-platform/core/client';
import {
  useSpacesByWeb3Ids,
  useTokenDecimals,
} from '@hypha-platform/core/client';
import { CURRENCY_FEED_OPTIONS } from '@hypha-platform/core/client';
import React from 'react';
import { formatUnits } from 'viem';
import { useTokens, useVaults, type ExtendedToken } from '../../treasury';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { getTokenSymbol } from './token-backing-vault/get-token-symbol';
import { TokenBackingVaultDetailRow } from './token-backing-vault/token-backing-vault-detail-row';

const CURRENCY_FEED_BY_ADDRESS = Object.fromEntries(
  CURRENCY_FEED_OPTIONS.map((opt) => [opt.value.toLowerCase(), opt.label]),
);

export interface ProposalRedeemTokensDataProps {
  amount?: bigint;
  token?: `0x${string}`;
  web3SpaceId?: bigint;
  conversions: {
    asset?: `0x${string}`;
    percentage?: bigint;
  }[];
  spaceSlug: string;
  dbTokens?: DbToken[];
}

export const ProposalRedeemTokensData = ({
  amount,
  token,
  web3SpaceId,
  spaceSlug,
  dbTokens = [],
}: ProposalRedeemTokensDataProps) => {
  const t = useTranslations('ProposalDetails.labels');
  const { spaces } = useSpacesByWeb3Ids(web3SpaceId ? [web3SpaceId] : []);
  const resolvedSlug = spaces?.[0]?.slug ?? spaceSlug;
  const { tokens: spaceTokens } = useTokens({ spaceSlug: resolvedSlug });
  const { vaults } = useVaults();
  const { decimals: redeemDecimals } = useTokenDecimals(token);

  const spaceTokenList = React.useMemo(() => {
    return spaceTokens.map((tok: ExtendedToken) => ({
      address: tok.address,
      symbol: tok.symbol,
      icon: tok.icon,
    }));
  }, [spaceTokens]);

  const vaultForRedeem = React.useMemo(() => {
    if (!token) return undefined;
    return vaults.find(
      (v) => v.spaceToken.toLowerCase() === token.toLowerCase(),
    );
  }, [token, vaults]);

  const currencyLabel =
    vaultForRedeem?.redemptionCurrencyFeed &&
    (CURRENCY_FEED_BY_ADDRESS[
      vaultForRedeem.redemptionCurrencyFeed.toLowerCase()
    ] ??
      'USD');

  const redemptionPriceNum = vaultForRedeem?.redemptionPrice;

  const redeemedHuman = React.useMemo(() => {
    if (amount === undefined || redeemDecimals === undefined) return null;
    return formatUnits(amount, redeemDecimals);
  }, [amount, redeemDecimals]);

  const notionalValue = React.useMemo(() => {
    if (
      redeemedHuman === null ||
      typeof redemptionPriceNum !== 'number' ||
      !Number.isFinite(redemptionPriceNum)
    ) {
      return null;
    }
    const qty = Number(redeemedHuman);
    if (!Number.isFinite(qty)) return null;
    return qty * redemptionPriceNum;
  }, [redeemedHuman, redemptionPriceNum]);

  const redeemSymbol = token
    ? getTokenSymbol(token, dbTokens, spaceTokenList)
    : '';

  if (!amount || !token || !redeemedHuman) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">
        {t('redeemTokens')}
      </span>
      <div className="flex flex-col gap-5">
        <TokenBackingVaultDetailRow
          label={t('redeemAmount')}
          value={`${formatCurrencyValue(redeemedHuman)} ${redeemSymbol}`}
        />
        {typeof redemptionPriceNum === 'number' &&
        Number.isFinite(redemptionPriceNum) ? (
          <TokenBackingVaultDetailRow
            label={t('redemptionPrice')}
            value={`${redemptionPriceNum.toFixed(2)} ${
              currencyLabel ?? 'USD'
            } / ${redeemSymbol}`}
          />
        ) : null}
        {typeof notionalValue === 'number' && Number.isFinite(notionalValue) ? (
          <TokenBackingVaultDetailRow
            label={t('redeemNotional')}
            value={t('redeemApproxUsd', {
              value: formatCurrencyValue(notionalValue),
            })}
          />
        ) : null}
      </div>

      {vaultForRedeem && vaultForRedeem.collaterals.length > 0 ? (
        <div className="flex flex-col gap-4">
          <span className="text-neutral-11 text-2 font-medium">
            {t('tokenBackingVault')}
          </span>
          <div className="flex flex-col gap-2">
            {vaultForRedeem.collaterals.map((collateral, i) => (
              <div
                key={`${collateral.address}-${i}`}
                className="flex justify-between items-center gap-3 text-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {collateral.icon ? (
                    <img
                      src={collateral.icon}
                      alt={collateral.symbol}
                      className="w-4 h-4 rounded-full shrink-0"
                    />
                  ) : null}
                  <span className="truncate text-foreground">
                    {collateral.symbol}
                  </span>
                </div>
                <div className="text-nowrap text-right shrink-0">
                  <span className="text-foreground">
                    {formatCurrencyValue(collateral.value)} {collateral.symbol}
                  </span>
                  {collateral.usdEqual > 0 ? (
                    <span className="text-neutral-9 ml-1">
                      (${formatCurrencyValue(collateral.usdEqual)})
                    </span>
                  ) : null}
                  {typeof collateral.tokenPrice === 'number' &&
                  Number.isFinite(collateral.tokenPrice) ? (
                    <span className="text-neutral-9 ml-1">
                      ·{' '}
                      {t('redeemCollateralUnitPrice', {
                        price: formatCurrencyValue(collateral.tokenPrice),
                        currency: currencyLabel ?? 'USD',
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
