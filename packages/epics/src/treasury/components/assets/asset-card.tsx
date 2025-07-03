import { Text } from '@radix-ui/themes';
import { Card, Skeleton, Image } from '@hypha-platform/ui';
import { Amount } from '@hypha-platform/ui/server';

type AssetCardProps = {
  icon?: string;
  name?: string;
  symbol?: string;
  value?: number;
  usdEqual?: number;
  status?: string;
  isLoading?: boolean;
};

export const AssetCard: React.FC<AssetCardProps> = ({
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
        <div className="mr-5">
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading}
            className="rounded-full"
          >
            <Image
              src={icon ? icon : ''}
              height={40}
              width={40}
              alt={name ? name : ''}
            />
          </Skeleton>
        </div>
        <div className="flex flex-col justify-center">
          <Skeleton
            width="80px"
            height="16px"
            loading={isLoading}
            className="mb-1"
          >
            <Text className="text-4 font-medium text-secondary-foreground">
              {name}
            </Text>
          </Skeleton>
          <Skeleton width="80px" height="16px" loading={isLoading}>
            <Text className="text-1 text-gray-500">{symbol}</Text>
          </Skeleton>
        </div>
      </div>
      <div className="w-full flex flex-row">
        <Amount
          className="text-secondary-foreground"
          isLoading={isLoading}
          value={usdEqual}
          variant="ghost"
          size="xs"
          withUsdSymbol
        />
        <Amount
          className="ml-1"
          isLoading={isLoading}
          value={value}
          variant="ghost"
          size="xs"
        >
          {symbol}
        </Amount>
      </div>
    </Card>
  );
};
