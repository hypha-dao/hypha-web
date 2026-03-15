'use client';

import { Text } from '@radix-ui/themes';
import { Card, Skeleton, Image } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

type VaultCollateralCardProps = {
  icon?: string;
  name?: string;
  symbol?: string;
  value?: number;
  usdEqual?: number;
  isLoading?: boolean;
};

export const VaultCollateralCard: React.FC<VaultCollateralCardProps> = ({
  icon,
  name,
  symbol,
  value,
  usdEqual,
  isLoading,
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
              src={icon ?? ''}
              height={32}
              width={32}
              alt={name ?? ''}
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
            <Text className="text-1 text-gray-500">{symbol}</Text>
          </Skeleton>
        </div>
      </div>
      <div className="w-full flex flex-row gap-1">
        <Text className="text-1">{name}</Text>
        {usdEqual !== undefined && usdEqual > 0 && (
          <Text className="text-1 text-neutral-11">
            {`≈ $ ${formatCurrencyValue(usdEqual)}`}
          </Text>
        )}
      </div>
    </Card>
  );
};
