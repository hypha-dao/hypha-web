import { Text } from '@radix-ui/themes';
import { Card, Badge, Skeleton } from '@hypha-platform/ui';
import { CalendarIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import { Amount } from '@hypha-platform/ui/server';
import { ZeroAddress } from 'ethers';

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
  from?: string;
  to?: string;
  memo?: string;
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
  from,
  to,
  memo,
}) => {
  const displayName = title
    ? title
    : name
    ? `${name || ''} ${surname || ''}`.trim()
    : counterparty === 'from'
    ? from
    : to;

  const isBurn = () => {
    return to === ZeroAddress && counterparty === 'to';
  };

  return (
    <Card className="flex flex-col mb-2">
      <div className="w-full p-5">
        <div className="flex space-x-3">
          <Skeleton
            loading={isLoading}
            className="w-[64px] h-[64px] rounded-full"
          >
            <img
              src={tokenIcon || '/placeholder/token-icon.svg'}
              alt="Token Icon"
              className="w-[64px] h-[64px] rounded-full object-cover"
            />
          </Skeleton>
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col">
              <div className="flex gap-x-1">
                {symbol ? (
                  <Badge
                    isLoading={isLoading}
                    variant="surface"
                    colorVariant="accent"
                  >
                    {symbol}
                  </Badge>
                ) : null}
                <Badge
                  isLoading={isLoading}
                  variant="surface"
                  colorVariant="accent"
                >
                  {isMint ? 'Mint' : isBurn() ? 'Burn' : 'Transfer'}
                </Badge>
                <Badge
                  isLoading={isLoading}
                  variant="surface"
                  colorVariant={
                    isMint || direction === 'incoming' ? 'success' : 'error'
                  }
                >
                  {counterparty === 'from' ? 'In' : 'Out'}
                </Badge>
              </div>
              <Amount isLoading={isLoading} value={value} />
              {!isMint && !isBurn() && (
                <Skeleton loading={isLoading} width="80px" height="16px">
                  <Text className="text-1 text-neutral-11">
                    {displayName
                      ? `${
                          counterparty === 'from' ? 'From' : 'To'
                        } ${displayName}`
                      : null}
                  </Text>
                </Skeleton>
              )}
            </div>
            <Skeleton width="96px" height="16px" loading={isLoading}>
              <div className="flex h-full justify-end items-end text-neutral-11">
                <CalendarIcon className="mr-1" />
                <Text className="text-1">
                  {date ? formatDate(date, true) : null}
                </Text>
              </div>
            </Skeleton>
          </div>
        </div>

        {memo && (
          <div className="mt-3 pt-3 border-t border-neutral-6 text-2 text-neutral-11">
            Memo: <Text>{memo}</Text>
          </div>
        )}
      </div>
    </Card>
  );
};
