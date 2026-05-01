'use client';

import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { getDhoPathAgreements } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

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
  mutualCredit,
}) => {
  const tTreasury = useTranslations('TreasuryTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const format = useFormatter();

  const tokenTypeLabel =
    type === 'Collateral'
      ? tTreasury('assetCard.collateralType')
      : type &&
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

  const valueLine = valueDisplay ?? formatCurrencyValue(value ?? 0, lang);
  const priceLine =
    tokenPrice !== undefined && tokenPrice > 0
      ? `${formatCurrencyValue(tokenPrice)} ${
          referenceCurrency?.trim() || 'USD'
        }`
      : null;
  const issuanceLine =
    supply?.total !== undefined
      ? tTreasury('assetCard.totalIssuance', {
          value: formatCurrencyValue(supply.total, lang),
        })
      : null;
  const createdLine =
    createdAt instanceof Date && !Number.isNaN(createdAt.getTime())
      ? tTreasury('assetCard.createdOn', {
          date: format.dateTime(createdAt, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })
      : null;

  const heroVisual = (
    <div className="relative isolate overflow-hidden">
      <div
        className={cn(
          'relative h-[4.5rem] w-full overflow-hidden bg-muted/50',
          'after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:via-background/55 after:to-background',
        )}
      >
        {isLoading ? (
          <Skeleton
            className="h-full w-full rounded-none"
            loading
            height="100%"
          />
        ) : icon ? (
          <img
            src={icon}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-accent-5/30 via-muted/55 to-background"
            aria-hidden
          />
        )}
      </div>
      <div className="relative z-10 -mt-9 px-3">
        <Skeleton
          width="56px"
          height="56px"
          loading={isLoading}
          className="rounded-full"
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-card shadow-md ring-4 ring-card">
            <Image
              className="h-full w-full object-cover"
              src={icon ? icon : '/placeholder/default-space.svg'}
              height={56}
              width={56}
              alt={name ? tTreasury('assetCard.tokenIconAlt', { name }) : ''}
            />
          </div>
        </Skeleton>
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        'flex h-full min-h-[14rem] w-full min-w-0 flex-col overflow-hidden p-0',
        'border-border/80 transition-shadow duration-150 hover:border-border hover:shadow-sm',
        'motion-reduce:transition-none',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {heroVisual}

        <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 pb-3 pt-1">
          <div className="flex min-w-0 items-start justify-between gap-2 pt-0.5">
            {isLoading ? (
              <Skeleton
                className="my-0.5"
                width="5rem"
                height="1.25rem"
                loading
              />
            ) : (
              <p
                className="text-4 font-semibold tabular-nums leading-tight tracking-tight text-foreground"
                title={valueLine}
              >
                {valueLine}
              </p>
            )}
            {type && tokenTypeLabel ? (
              isLoading ? (
                <Skeleton className="h-5 w-16 shrink-0" loading />
              ) : (
                <Badge
                  className="h-fit max-w-[48%] shrink-0 border text-[10px] font-medium uppercase"
                  colorVariant="accent"
                  variant="outline"
                >
                  {tokenTypeLabel}
                </Badge>
              )
            ) : null}
          </div>

          {isLoading ? (
            <Skeleton className="h-4 w-12" loading />
          ) : (
            <p className="line-clamp-1 text-1 font-medium text-muted-foreground">
              {symbol}
            </p>
          )}

          {isLoading ? (
            <Skeleton className="h-4 w-[60%] max-w-[12rem]" loading />
          ) : name ? (
            <p className="line-clamp-2 text-1 leading-snug text-muted-foreground">
              {name}
            </p>
          ) : null}

          {space?.title && lang ? (
            isLoading ? (
              <Skeleton className="h-4 w-32" loading />
            ) : (
              <Link
                href={getDhoPathAgreements(lang, space.slug)}
                className="line-clamp-2 text-left text-1 font-medium text-accent-11 underline-offset-2 hover:underline"
              >
                {tTreasury('assetCard.fromSpace', {
                  spaceTitle: space.title,
                })}
              </Link>
            )
          ) : null}

          {(priceLine || issuanceLine) && (
            <dl className="mt-1 space-y-1.5 border-t border-border/50 pt-2 text-1 leading-snug text-muted-foreground">
              {priceLine ? (
                <div className="flex min-w-0 justify-between gap-2">
                  <dt className="shrink-0 text-muted-foreground/90">
                    {tTreasury('assetCard.referencePrice')}
                  </dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">
                    {priceLine}
                  </dd>
                </div>
              ) : null}
              {issuanceLine ? (
                <div className="flex min-w-0 justify-between gap-2">
                  <dt className="shrink-0 text-muted-foreground/90">
                    {tTreasury('assetCard.issuanceLabel')}
                  </dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">
                    {issuanceLine}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}

          {mutualCredit && symbol ? (
            <div className="flex w-full flex-row flex-wrap items-center gap-2 border-t border-border/50 pt-2">
              {mutualCredit.netBalance !== 0 ? (
                <Badge
                  colorVariant={mutualCredit.netBalance < 0 ? 'warn' : 'accent'}
                  variant="outline"
                  className="h-fit w-fit"
                >
                  {mutualCredit.netBalance < 0
                    ? tTreasury('assetCard.mutualCredit.debtBadge', {
                        amount: formatCurrencyValue(
                          Math.abs(mutualCredit.netBalance),
                          lang,
                        ),
                        symbol,
                      })
                    : tTreasury('assetCard.mutualCredit.netBadge', {
                        amount: formatCurrencyValue(
                          mutualCredit.netBalance,
                          lang,
                        ),
                        symbol,
                      })}
                </Badge>
              ) : null}
              {mutualCredit.defaultCreditLimit > 0 ? (
                <span className="text-1 text-muted-foreground">
                  {tTreasury('assetCard.mutualCredit.limit', {
                    limit: formatCurrencyValue(
                      mutualCredit.defaultCreditLimit,
                      lang,
                    ),
                    symbol,
                  })}
                </span>
              ) : null}
            </div>
          ) : null}

          {createdLine ? (
            isLoading ? (
              <Skeleton className="mt-auto h-4 w-full" loading />
            ) : (
              <p className="mt-auto line-clamp-2 pt-1 text-[11px] leading-snug text-muted-foreground">
                {createdLine}
              </p>
            )
          ) : null}
        </div>
      </div>
    </Card>
  );
};
