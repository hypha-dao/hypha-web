import { Text } from '@radix-ui/themes';
import { Card, BadgeCva } from '@hypha-platform/ui';
import Image from 'next/image';
import { CalendarIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import { Skeleton } from '@hypha-platform/ui';
import { Amount } from '@hypha-platform/ui/server';

type RequestCardProps = {
  name?: string;
  surname?: string;
  avatar?: string;
  value?: number;
  symbol?: string;
  date?: string;
  isLoading?: boolean;
};

export const RequestCard: React.FC<RequestCardProps> = ({
  name,
  surname,
  avatar,
  value,
  symbol,
  date,
  isLoading,
}) => {
  return (
    <Card className="w-full h-full p-5 mb-2 flex">
      <Skeleton
        loading={isLoading}
        width="64px"
        height="64px"
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
            <BadgeCva
              isLoading={isLoading}
              variant="surface"
              colorVariant="accent"
            >
              {symbol}
            </BadgeCva>
            <BadgeCva
              isLoading={isLoading}
              variant="surface"
              colorVariant="warn"
            >
              Pending
            </BadgeCva>
          </div>
          <Amount isLoading={isLoading} value={value} withUsdSymbol />
          <Skeleton loading={isLoading} width="80px" height="16px">
            <Text className="text-1 text-gray-500">
              {name} {surname}
            </Text>
          </Skeleton>
        </div>
        <Skeleton width="96px" height="16px" loading={isLoading}>
          <div className="flex h-full justify-end items-end text-gray-500">
            <CalendarIcon className="mr-1" />
            <Text className="text-1">{date ? formatDate(date) : null}</Text>
          </div>
        </Skeleton>
      </div>
    </Card>
  );
};
