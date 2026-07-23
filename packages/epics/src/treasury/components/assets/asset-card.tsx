'use client';

import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { cn, formatCurrencyValue } from '@hypha-platform/ui-utils';
import { getDhoPathDefaultLanding } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';

type AssetCardProps = {
  icon?: string;
  name?: string;
  symbol?: string;
  value?: number;
  /** Override value display (e.g. for small reward amounts) */
  valueDisplay?: string;
  tokenPrice?: number;
  /** Fiat / reference label from DB when token price is set (e.g. EUR, USD) */
  referenceCurrency?: string | null;
  usdEqual?: number;
  type?: string;
  isLoading?: boolean;
  supply?: {
    total: number;
  };
  space?: {
    title: string;
    slug: string;
  };
  lang?: Locale;
  createdAt?: Date;
  /**
   * `grid` — uniform Balance token cells (default).
   * `solo` — single Rewards card: auto height, filled composition, demoted meta.
   */
  layout?: 'grid' | 'solo';
  /**
   * Mutual credit info — only rendered when the underlying token has mutual
   * credit enabled. `netBalance < 0` indicates the holder is in debt.
   */
  mutualCredit?: {
    defaultCreditLimit: number;
    creditBalance: number;
    netBalance: number;
    whitelistedSpaceIds: number[];
  };
};

export const AssetCard: React.FC<AssetCardProps> = ({
  icon,
  name,
  symbol,
  value,
  valueDisplay,
  tokenPrice,
  referenceCurrency,
  isLoading,
  supply,
  space,
  lang,
  type,
  createdAt,
  layout = 'grid',
  mutualCredit,
}) => {
  const tTreasury = useTranslations('TreasuryTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const format = useFormatter();
  const isSolo = layout === 'solo';
  const tokenTypeLabel =
    type &&
    tAgreementFlow.has(
      `plugins.issueNewToken.general.tokenTypeOptions.${type}.label` as Parameters<
        typeof tAgreementFlow
      >[0],
    )
      ? tAgreementFlow(
          `plugins.issueNewToken.general.tokenTypeOptions.${type}.label` as Parameters<
            typeof tAgreementFlow
          >[0],
        )
      : type;

  const hasPrice = tokenPrice !== undefined && tokenPrice > 0;
  const hasSupply = supply?.total !== undefined;
  const hasValidCreatedAt =
    createdAt instanceof Date && !Number.isNaN(createdAt.getTime());
  const priceLabel = hasPrice
    ? `${formatCurrencyValue(tokenPrice)} ${referenceCurrency?.trim() || 'USD'}`
    : null;
  const amountLabel = valueDisplay ?? formatCurrencyValue(value ?? 0, lang);
  const issuanceLabel =
    hasSupply && supply
      ? tTreasury('assetCard.totalIssuance', {
          value: formatCurrencyValue(supply.total, lang),
        })
      : null;
  const hasNameRow = Boolean(name) || Boolean(priceLabel);
  const hasSpaceRow = Boolean(space?.title) || hasValidCreatedAt;
  const hasMutualCreditRow = Boolean(mutualCredit && symbol);
  const hasMeta =
    hasNameRow || Boolean(issuanceLabel) || hasSpaceRow || hasMutualCreditRow;

  return (
    <Card
      className={cn(
        'group flex w-full flex-col gap-3 p-3.5',
        'rounded-lg border-border/70 bg-background-2 shadow-none',
        'transition-[border-color,background-color] duration-200 ease-out',
        'hover:border-border hover:bg-muted/15',
        isSolo ? 'h-auto' : 'h-full min-h-[10.5rem]',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Skeleton
          width="32px"
          height="32px"
          loading={isLoading}
          className="shrink-0 rounded-full"
        >
          <Image
            className="size-8 min-h-8 min-w-8 rounded-full"
            src={icon ? icon : ''}
            height={32}
            width={32}
            alt={name ? name : ''}
          />
        </Skeleton>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Skeleton width="96px" height="20px" loading={isLoading}>
            {isSolo ? (
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-3 font-medium tracking-tight text-foreground">
                <span className="tabular-nums">{amountLabel}</span>
                {symbol ? (
                  <span className="text-1 font-normal text-muted-foreground">
                    {symbol}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="truncate text-3 font-medium tracking-tight text-foreground tabular-nums">
                {amountLabel}
              </p>
            )}
          </Skeleton>
          {!isSolo ? (
            <Skeleton width="88px" height="16px" loading={isLoading}>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-1 text-muted-foreground">
                  {symbol}
                </span>
                {type ? (
                  <Badge
                    size={1}
                    colorVariant="neutral"
                    variant="soft"
                    className="h-fit w-fit shrink-0 font-normal"
                  >
                    {tokenTypeLabel}
                  </Badge>
                ) : null}
              </div>
            </Skeleton>
          ) : type ? (
            <Skeleton width="72px" height="16px" loading={isLoading}>
              <Badge
                size={1}
                colorVariant="neutral"
                variant="soft"
                className="h-fit w-fit shrink-0 font-normal"
              >
                {tokenTypeLabel}
              </Badge>
            </Skeleton>
          ) : null}
        </div>
      </div>

      {isLoading || hasMeta ? (
        <div
          className={cn(
            'flex flex-col gap-0.5 text-1 text-muted-foreground',
            !isSolo && 'mt-auto min-h-[4.5rem] justify-end',
          )}
        >
          {isLoading || hasNameRow ? (
            <Skeleton width="100%" height="14px" loading={isLoading}>
              <div className="flex h-4 min-w-0 items-baseline gap-x-1.5 truncate">
                {name ? (
                  <span className="truncate text-foreground/75">{name}</span>
                ) : null}
                {priceLabel ? (
                  <span className="shrink-0 tabular-nums">· {priceLabel}</span>
                ) : null}
              </div>
            </Skeleton>
          ) : null}

          {isLoading || issuanceLabel ? (
            <Skeleton width="100%" height="14px" loading={isLoading}>
              <div
                className={cn(
                  'h-4 min-w-0 truncate tabular-nums',
                  isSolo && 'craft-meta',
                )}
              >
                {issuanceLabel}
              </div>
            </Skeleton>
          ) : null}

          {isLoading || hasSpaceRow ? (
            <Skeleton width="100%" height="14px" loading={isLoading}>
              <div className="flex h-4 min-w-0 items-center gap-x-2 truncate">
                {space?.title ? (
                  <Link
                    href={getDhoPathDefaultLanding(lang as Locale, space.slug)}
                    className="min-w-0 truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    {tTreasury('assetCard.fromSpace', {
                      spaceTitle: space.title,
                    })}
                  </Link>
                ) : null}
                {hasValidCreatedAt ? (
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      space?.title && 'before:mr-2 before:content-["·"]',
                    )}
                  >
                    {format.dateTime(createdAt, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                ) : null}
              </div>
            </Skeleton>
          ) : null}

          {hasMutualCreditRow ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              {mutualCredit!.netBalance !== 0 ? (
                <Badge
                  size={1}
                  colorVariant={
                    mutualCredit!.netBalance < 0 ? 'warn' : 'neutral'
                  }
                  variant="soft"
                  className="h-fit w-fit font-normal"
                >
                  {mutualCredit!.netBalance < 0
                    ? tTreasury('assetCard.mutualCredit.debtBadge', {
                        amount: formatCurrencyValue(
                          Math.abs(mutualCredit!.netBalance),
                          lang,
                        ),
                        symbol,
                      })
                    : tTreasury('assetCard.mutualCredit.netBadge', {
                        amount: formatCurrencyValue(
                          mutualCredit!.netBalance,
                          lang,
                        ),
                        symbol,
                      })}
                </Badge>
              ) : null}
              {mutualCredit!.defaultCreditLimit > 0 ? (
                <span className="truncate tabular-nums">
                  {tTreasury('assetCard.mutualCredit.limit', {
                    limit: formatCurrencyValue(
                      mutualCredit!.defaultCreditLimit,
                      lang,
                    ),
                    symbol,
                  })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};
