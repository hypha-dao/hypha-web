import { Text } from '@radix-ui/themes';
import { Card, Badge, Skeleton } from '@hypha-platform/ui';
import { CalendarIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import { Amount } from '@hypha-platform/ui/server';
import { PersonAvatar } from '../../../people/components/person-avatar';

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
            <Badge isLoading={isLoading} variant="surface" colorVariant="warn">
              Pending
            </Badge>
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
