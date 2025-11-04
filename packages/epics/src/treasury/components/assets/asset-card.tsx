import { Text } from '@radix-ui/themes';
import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { formatCurrencyValue, formatDate } from '@hypha-platform/ui-utils';
import { getDhoPathAgreements } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';

type AssetCardProps = {
  icon?: string;
  name?: string;
  symbol?: string;
  value?: number;
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
};

export const AssetCard: React.FC<AssetCardProps> = ({
  icon,
  name,
  symbol,
  value,
  usdEqual,
  isLoading,
  supply,
  space,
  lang,
  type,
  createdAt,
}) => {
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
              {formatCurrencyValue(value ?? 0)}
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
                    className="w-fit capitalize h-fit"
                  >
                    {type}
                  </Badge>
                )}
              </span>
              {space?.title ? (
                <Link
                  href={getDhoPathAgreements(lang as Locale, space.slug)}
                  className="text-accent-11 text-1 text-ellipsis overflow-hidden hover:underline"
                >
                  from {space.title}
                </Link>
              ) : null}
            </span>
          </Skeleton>
        </div>
      </div>
      <div className="w-full flex flex-row gap-1">
        <Text className="text-1">{name}</Text>
        {supply?.total !== undefined && (
          <Text className="text-1 text-neutral-11">
            {`Total Issuance: ${formatCurrencyValue(supply.total)}`}
          </Text>
        )}
      </div>
      <div className="w-full flex flex-row gap-1">
        {createdAt !== undefined && !Number.isNaN(createdAt.getTime?.()) && (
          <Text className="text-1 text-neutral-11">
            {`Created on ${formatDate(createdAt, true)}`}
          </Text>
        )}
      </div>
    </Card>
  );
};
