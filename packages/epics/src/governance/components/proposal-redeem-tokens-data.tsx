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

function RedeemCollateralRow({
  assetAddress,
  percentageBps,
  collateral,
  spaceTokens,
  dbTokens,
}: {
  assetAddress: `0x${string}`;
  percentageBps: bigint;
  collateral:
    | {
        icon: string;
        symbol: string;
        value: number;
        usdEqual: number;
      }
    | undefined;
  spaceTokens: { address?: string; symbol?: string; icon?: string }[];
  dbTokens?: DbToken[];
}) {
  const pct = Number(percentageBps) / 10000;
  if (!Number.isFinite(pct) || pct <= 0) return null;

  const symbol = getTokenSymbol(assetAddress, dbTokens, spaceTokens);
  const db = dbTokens?.find(
    (d) => d.address?.toLowerCase() === assetAddress.toLowerCase(),
  );
  const st = spaceTokens.find(
    (s) => s.address?.toLowerCase() === assetAddress.toLowerCase(),
  );
  const iconSrc = st?.icon ?? db?.iconUrl ?? collateral?.icon;

  let payoutQty: number | undefined;
  let payoutUsd: number | undefined;
  if (collateral) {
    payoutQty = collateral.value * pct;
    payoutUsd = collateral.usdEqual > 0 ? collateral.usdEqual * pct : undefined;
  }

  return (
    <div className="flex justify-between items-center text-1 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt={symbol}
            className="w-4 h-4 rounded-full shrink-0"
          />
        ) : null}
        <span className="truncate">{symbol}</span>
      </div>
      <div className="text-nowrap text-right shrink-0">
        {typeof payoutQty === 'number' && Number.isFinite(payoutQty) ? (
          <>
            {formatCurrencyValue(payoutQty)} {symbol}
            {typeof payoutUsd === 'number' &&
            Number.isFinite(payoutUsd) &&
            payoutUsd > 0 ? (
              <span className="text-neutral-9 ml-1">
                (${formatCurrencyValue(payoutUsd)})
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-neutral-9">—</span>
        )}
      </div>
    </div>
  );
}

export const ProposalRedeemTokensData = ({
  amount,
  token,
  web3SpaceId,
  conversions,
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

  const collateralByAddress = React.useMemo(() => {
    const map = new Map<
      string,
      { icon: string; symbol: string; value: number; usdEqual: number }
    >();
    for (const c of vaultForRedeem?.collaterals ?? []) {
      map.set(c.address.toLowerCase(), {
        icon: c.icon,
        symbol: c.symbol,
        value: c.value,
        usdEqual: c.usdEqual,
      });
    }
    return map;
  }, [vaultForRedeem?.collaterals]);

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
          label={t('redeemToken')}
          value={redeemSymbol || token}
        />
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

        {conversions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="text-1 text-neutral-11">
              {t('redeemCollateralPayout')}
            </div>
            {conversions.map((conversion, index) => {
              const addr = conversion.asset;
              if (!addr || conversion.percentage === undefined) return null;
              const collateral = collateralByAddress.get(addr.toLowerCase());
              return (
                <RedeemCollateralRow
                  key={`${addr}-${index}`}
                  assetAddress={addr}
                  percentageBps={conversion.percentage}
                  collateral={collateral}
                  spaceTokens={spaceTokenList}
                  dbTokens={dbTokens}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};
