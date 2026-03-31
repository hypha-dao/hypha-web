'use client';

import type { DbToken } from '@hypha-platform/core/client';
import {
  bigIntToPercentageString,
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
  conversions,
  spaceSlug,
  dbTokens = [],
}: ProposalRedeemTokensDataProps) => {
  const t = useTranslations('ProposalDetails');
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

  const collateralByAddress = React.useMemo(() => {
    const map = new Map<
      string,
      {
        icon: string;
        symbol: string;
        value: number;
        usdEqual: number;
        tokenPrice?: number;
      }
    >();
    for (const c of vaultForRedeem?.collaterals ?? []) {
      map.set(c.address.toLowerCase(), {
        icon: c.icon,
        symbol: c.symbol,
        value: c.value,
        usdEqual: c.usdEqual,
        tokenPrice: c.tokenPrice,
      });
    }
    return map;
  }, [vaultForRedeem?.collaterals]);

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

  const conversionDisplayRows = React.useMemo(() => {
    return conversions
      .filter(
        (c): c is { asset: `0x${string}`; percentage: bigint } =>
          Boolean(c.asset) && c.percentage !== undefined,
      )
      .map((c) => {
        const addr = c.asset.toLowerCase();
        const collateral = collateralByAddress.get(addr);
        const st = spaceTokenList.find(
          (s: { address?: string; symbol: string; icon?: string }) =>
            s.address?.toLowerCase() === addr,
        );
        const icon = collateral?.icon ?? st?.icon;
        const symbol = getTokenSymbol(c.asset, dbTokens, spaceTokenList);
        const pctStr = `${bigIntToPercentageString(c.percentage)}%`;
        const share = Number(c.percentage) / 10000;
        const requested =
          typeof notionalValue === 'number' &&
          Number.isFinite(notionalValue) &&
          Number.isFinite(share)
            ? notionalValue * share
            : null;
        const requestedDisplay =
          requested !== null && Number.isFinite(requested)
            ? `${formatCurrencyValue(requested)} ${currencyLabel ?? 'USD'}`
            : '—';

        const vaultRight =
          collateral &&
          typeof collateral.value === 'number' &&
          Number.isFinite(collateral.value) ? (
            <>
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
                  {t('labels.redeemCollateralUnitPrice', {
                    price: formatCurrencyValue(collateral.tokenPrice),
                    currency: currencyLabel ?? 'USD',
                  })}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-neutral-9">—</span>
          );

        return {
          asset: c.asset,
          icon,
          symbol,
          requestedDisplay,
          pctStr,
          vaultRight,
        };
      });
  }, [
    collateralByAddress,
    conversions,
    currencyLabel,
    dbTokens,
    notionalValue,
    spaceTokenList,
    t,
  ]);

  if (!amount || !token || !redeemedHuman) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">
        {t('labels.redeemTokens')}
      </span>
      <div className="flex flex-col gap-5">
        <TokenBackingVaultDetailRow
          label={t('labels.redeemAmount')}
          value={`${formatCurrencyValue(redeemedHuman)} ${redeemSymbol}`}
        />
        {typeof redemptionPriceNum === 'number' &&
        Number.isFinite(redemptionPriceNum) ? (
          <TokenBackingVaultDetailRow
            label={t('labels.redemptionPrice')}
            value={`${redemptionPriceNum.toFixed(2)} ${
              currencyLabel ?? 'USD'
            } / ${redeemSymbol}`}
          />
        ) : null}
        {typeof notionalValue === 'number' && Number.isFinite(notionalValue) ? (
          <TokenBackingVaultDetailRow
            label={t('labels.redeemNotional')}
            value={t('labels.redeemApproxUsd', {
              value: formatCurrencyValue(notionalValue),
            })}
          />
        ) : null}
      </div>

      {conversionDisplayRows.length > 0 ? (
        <div className="flex flex-col gap-4">
          <span className="text-neutral-11 text-2 font-medium">
            {t('labels.backingVaultPayout')}
          </span>
          <div className="flex flex-col gap-2">
            {conversionDisplayRows.map((row, i) => (
              <div
                key={`${row.asset}-${i}`}
                className="flex justify-between items-center gap-3 text-1 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {row.icon ? (
                    <img
                      src={row.icon}
                      alt={row.symbol}
                      className="w-4 h-4 rounded-full shrink-0"
                    />
                  ) : null}
                  <span className="min-w-0 break-words">
                    <span className="font-medium text-foreground">
                      {row.symbol}
                    </span>
                    <span className="text-neutral-9 font-normal">
                      {' '}
                      · {row.requestedDisplay} · {row.pctStr}
                    </span>
                  </span>
                </div>
                <div className="text-nowrap text-right shrink-0 text-1">
                  {row.vaultRight}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
