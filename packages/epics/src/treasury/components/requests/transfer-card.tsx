import { Text } from '@radix-ui/themes';
import { Card, Badge, Skeleton } from '@hypha-platform/ui';
import { CalendarIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import { Amount } from '@hypha-platform/ui/server';
import { PersonAvatar } from '../../../people/components/person-avatar';

type TransferCardProps = {
  name?: string;
  surname?: string;
  avatar?: string;
  value?: number;
  symbol?: string;
  date?: string;
  isLoading?: boolean;
  direction?: 'incoming' | 'outgoing';
  counterparty?: 'from' | 'to';
};

export const TransferCard: React.FC<TransferCardProps> = ({
  name,
  surname,
  avatar,
  value,
  symbol,
  date,
  isLoading,
  direction,
  counterparty,
}) => {
  return (
    <Card className="w-full h-full p-5 mb-2 flex space-x-3">
      <PersonAvatar
        size="lg"
        isLoading={isLoading}
        avatarSrc={avatar}
        userName={`${name} ${surname}`}
      />
      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
            <Badge
              isLoading={isLoading}
              variant="surface"
              colorVariant="accent"
            >
              {symbol}
            </Badge>
            <Badge
              isLoading={isLoading}
              variant="surface"
              colorVariant={direction === 'incoming' ? 'success' : 'error'}
            >
              {counterparty === 'from' ? 'From' : 'To'}
            </Badge>
          </div>
          <Amount isLoading={isLoading} value={value} />
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
