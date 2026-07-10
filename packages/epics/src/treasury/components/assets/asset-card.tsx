'use client';

import { Text } from '@radix-ui/themes';
import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
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
   * Mutual credit info — only rendered when the underlying token has mutual
   * credit enabled. `netBalance < 0` indicates the holder is in debt.
   */
  mutualCredit?: {
    defaultCreditLimit: number;
    creditBalance: number;
    netBalance: number;
    whitelistedSpaceIds: number[];
  };
  referencePrice?: number | null;
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
  referencePrice,
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
    <Card className="w-full h-full p-5 mb-2 flex flex-col justify-between">
      <div className="w-full flex flex-row items-center mb-2">
        <div className="mr-3">
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading}
            className="rounded-full"
          >
            <Image
              className="rounded-full min-w-7 min-h-7"
              src={icon ? icon : ''}
              height={32}
              width={32}
              alt={name ? name : ''}
            />
          </Skeleton>
        </div>
        <div className="flex flex-col justify-center">
          <Skeleton
            width="80px"
            height="16px"
            loading={isLoading}
            className="mb-1 flex gap-1"
          >
            <Text className="text-4 font-medium text-secondary-foreground">
              {valueDisplay ?? formatCurrencyValue(value ?? 0, lang)}
            </Text>
          </Skeleton>
          <Skeleton width="80px" height="16px" loading={isLoading}>
            <span className="flex gap-2 items-center">
              <span className="flex gap-2 items-center">
                <Text className="text-1 text-gray-500">{symbol}</Text>
                {type && (
                  <Badge
                    colorVariant="accent"
                    variant="outline"
                    className="w-fit h-fit"
                  >
                    {tokenTypeLabel}
                  </Badge>
                )}
              </span>
              {space?.title ? (
                <Link
                  href={getDhoPathDefaultLanding(lang as Locale, space.slug)}
                  className="text-accent-11 text-1 text-ellipsis overflow-hidden hover:underline"
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
      <div className="w-full flex flex-row gap-1">
        <Text className="text-1">{name}</Text>
        {tokenPrice !== undefined && tokenPrice > 0 && (
          <Text className="text-1 text-neutral-11">
            {`${formatCurrencyValue(tokenPrice)} ${
              referenceCurrency?.trim() || 'USD'
            }`}
          </Text>
        )}
        {supply?.total !== undefined && (
          <Text className="text-1 text-neutral-11">
            {tTreasury('assetCard.totalIssuance', {
              value: formatCurrencyValue(supply.total, lang),
            })}
          </Text>
        )}
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
      {referencePrice !== null &&
        referencePrice !== undefined &&
        referenceCurrency && (
          <div className="w-full flex flex-row gap-1">
            <Text className="text-1 text-neutral-11">
              {tTreasury('assetCard.tokenPrice', {
                price: formatCurrencyValue(referencePrice, lang),
                currency: referenceCurrency,
              })}
            </Text>
          </div>
        )}
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
