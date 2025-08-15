import { Text } from '@radix-ui/themes';
import { Card, Badge, Skeleton } from '@hypha-platform/ui';
import { CalendarIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import { Amount } from '@hypha-platform/ui/server';
import { PersonAvatar } from '../../../people/components/person-avatar';

type TransferCardProps = {
  name?: string;
  surname?: string;
  title?: string;
  avatar?: string;
  tokenIcon?: string;
  value?: number;
  symbol?: string;
  date?: string;
  isLoading?: boolean;
  direction?: 'incoming' | 'outgoing';
  counterparty?: 'from' | 'to';
  isMint?: boolean;
};

export const TransferCard: React.FC<TransferCardProps> = ({
  name,
  surname,
  title,
  avatar,
  tokenIcon,
  value,
  symbol,
  date,
  isLoading,
  direction,
  counterparty,
  isMint,
}) => {
  const displayName = isMint
    ? ''
    : title || `${name || ''} ${surname || ''}`.trim() || 'Unknown';
  return (
    <Card className="w-full p-5 mb-2 flex space-x-3">
      {isMint ? (
        <img
          src={tokenIcon || '/placeholder/token-icon.png'}
          alt="Token Icon"
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <PersonAvatar
          size="lg"
          isLoading={isLoading}
          avatarSrc={avatar}
          userName={displayName}
        />
      )}
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
              colorVariant="accent"
            >
              {isMint ? 'Mint' : 'Transfer'}
            </Badge>
            <Badge
              isLoading={isLoading}
              variant="surface"
              colorVariant={
                isMint || direction === 'incoming' ? 'success' : 'error'
              }
            >
              {counterparty === 'from' ? 'From' : 'To'}
            </Badge>
          </div>
          <Amount isLoading={isLoading} value={value} />
          {!isMint && (
            <Skeleton loading={isLoading} width="80px" height="16px">
              <Text className="text-1 text-neutral-11">{displayName}</Text>
            </Skeleton>
          )}
        </div>
        <Skeleton width="96px" height="16px" loading={isLoading}>
          <div className="flex h-full justify-end items-end text-neutral-11">
            <CalendarIcon className="mr-1" />
            <Text className="text-1">{date ? formatDate(date) : null}</Text>
          </div>
        </Skeleton>
      </div>
    </Card>
  );
};
