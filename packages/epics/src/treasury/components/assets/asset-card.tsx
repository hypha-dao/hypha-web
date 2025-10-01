import { Text } from '@radix-ui/themes';
import { Card, Skeleton, Image } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
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
              className="rounded-full w-7 h-7"
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
            <span className="flex gap-1">
              <Text className="text-1 text-gray-500">{symbol}</Text>
              {space?.title ? (
                <Link
                  href={getDhoPathAgreements(lang as Locale, space.slug)}
                  className="text-accent-11 text-1 text-ellipsis overflow-hidden text-nowrap hover:underline"
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
    </Card>
  );
};
