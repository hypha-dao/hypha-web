import { Text } from '@radix-ui/themes';
import { Card, Badge, Skeleton } from '@hypha-platform/ui';
import Image from 'next/image';
import { CalendarIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import { Amount } from '@hypha-platform/ui/server';

type PayoutCardProps = {
  name?: string;
  surname?: string;
  avatar?: string;
  value?: number;
  symbol?: string;
  date?: string;
  status?: string;
  isLoading?: boolean;
};

export const PayoutCard: React.FC<PayoutCardProps> = ({
  name,
  surname,
  avatar,
  value,
  symbol,
  date,
  status,
  isLoading,
}) => {
  return (
    <Card className="w-full h-full p-6 mb-2 flex">
      <Skeleton
        width="64px"
        height="64px"
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={avatar ?? ''}
          height={64}
          width={64}
          alt={name ?? ''}
        />
      </Skeleton>
      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
            <Badge isLoading={isLoading} variant="actionOutline">
              {symbol}
            </Badge>
            {status === 'completed' ? (
              <Badge isLoading={isLoading} variant="positive">
                Completed
              </Badge>
            ) : (
              <Badge isLoading={isLoading} variant="destructive">
                Rejected
              </Badge>
            )}
          </div>
          <Amount isLoading={isLoading} value={value} />
          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-xs text-gray-500">
              {name} {surname}
            </Text>
          </Skeleton>
        </div>
        <Skeleton width="96px" height="16px" loading={isLoading}>
          <div className="flex h-full justify-end items-end text-gray-500">
            <CalendarIcon className="mr-1" />
            <Text className="text-xs">{date ? formatDate(date) : null}</Text>
          </div>
        </Skeleton>
      </div>
    </Card>
  );
};