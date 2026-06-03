'use client';

import { Text } from '@radix-ui/themes';
import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { getDhoPathAgreements } from '@hypha-platform/epics';
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
  usdEqual,
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

  return (
    <Card className="mb-2 flex h-full w-full min-w-0 flex-col justify-between p-4 sm:p-5">
      <div className="mb-2 flex w-full min-w-0 flex-row items-start gap-3">
        <div className="shrink-0">
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading}
            className="rounded-full"
          >
            <Image
              className="min-h-7 min-w-7 rounded-full"
              src={icon ? icon : ''}
              height={32}
              width={32}
              alt={name ? name : ''}
            />
          </Skeleton>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <Skeleton
            width="80px"
            height="16px"
            loading={isLoading}
            className="mb-0 flex gap-1"
          >
            <Text className="truncate text-3 font-medium text-secondary-foreground sm:text-4">
              {valueDisplay ?? formatCurrencyValue(value ?? 0, lang)}
            </Text>
          </Skeleton>
          <Skeleton width="80px" height="16px" loading={isLoading}>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <Text className="text-1 text-gray-500">{symbol}</Text>
                {type ? (
                  <Badge
                    colorVariant="accent"
                    variant="outline"
                    className="h-fit w-fit max-w-full truncate"
                  >
                    {tokenTypeLabel}
                  </Badge>
                ) : null}
              </span>
              {space?.title ? (
                <Link
                  href={getDhoPathAgreements(lang as Locale, space.slug)}
                  className="min-w-0 max-w-full truncate text-1 text-accent-11 hover:underline"
                >
                  {tTreasury('assetCard.fromSpace', {
                    spaceTitle: space.title,
                  })}
                </Link>
              ) : null}
            </span>
          </Skeleton>
        </div>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <Text className="min-w-0 text-1">{name}</Text>
        {tokenPrice !== undefined && tokenPrice > 0 ? (
          <Text className="shrink-0 text-1 text-neutral-11">
            {`${formatCurrencyValue(tokenPrice)} ${
              referenceCurrency?.trim() || 'USD'
            }`}
          </Text>
        ) : null}
        {supply?.total !== undefined ? (
          <Text className="text-1 text-neutral-11">
            {tTreasury('assetCard.totalIssuance', {
              value: formatCurrencyValue(supply.total, lang),
            })}
          </Text>
        ) : null}
      </div>
      {mutualCredit && symbol ? (
        <div className="w-full flex flex-row gap-2 flex-wrap items-center mt-1">
          {mutualCredit.netBalance !== 0 ? (
            <Badge
              colorVariant={mutualCredit.netBalance < 0 ? 'warn' : 'accent'}
              variant="outline"
              className="w-fit h-fit"
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
                    amount: formatCurrencyValue(mutualCredit.netBalance, lang),
                    symbol,
                  })}
            </Badge>
          ) : null}
          {mutualCredit.defaultCreditLimit > 0 && (
            <Text className="text-1 text-neutral-11">
              {tTreasury('assetCard.mutualCredit.limit', {
                limit: formatCurrencyValue(
                  mutualCredit.defaultCreditLimit,
                  lang,
                ),
                symbol,
              })}
            </Text>
          )}
        </div>
      ) : null}
      <div className="w-full flex flex-row gap-1">
        {createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) && (
          <Text className="text-1 text-neutral-11">
            {tTreasury('assetCard.createdOn', {
              date: format.dateTime(createdAt, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            })}
          </Text>
        )}
      </div>
    </Card>
  );
};
