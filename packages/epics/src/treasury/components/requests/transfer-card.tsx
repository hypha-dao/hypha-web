'use client';

import { Card, Badge, Skeleton } from '@hypha-platform/ui';
import { CalendarIcon } from '@radix-ui/react-icons';
import { Amount } from '@hypha-platform/ui/server';
import { ZeroAddress } from 'ethers';
import { useFormatter, useTranslations } from 'next-intl';
import { LOCAL_DATE_SHORT_FORMAT_OPTIONS } from '@hypha-platform/ui-utils';

type TransferCardProps = {
  name?: string;
  surname?: string;
  title?: string;
  avatar?: string;
  tokenIcon?: string;
  value?: number;
  symbol?: string;
  date?: string | number;
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
  const tTreasury = useTranslations('TreasuryTab');
  const format = useFormatter();
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

  // Show the counterparty line whenever it's a real account: covers regular
  // transfers and mints to other accounts (recipient), while hiding the
  // meaningless zero address on mints to the space and burns.
  const counterpartyAddress = counterparty === 'from' ? from : to;
  const hasCounterparty =
    !!counterpartyAddress && counterpartyAddress !== ZeroAddress;

  const parsedDate = date ? new Date(date) : null;
  const hasValidDate =
    parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const formattedDate = hasValidDate
    ? format.dateTime(parsedDate, LOCAL_DATE_SHORT_FORMAT_OPTIONS)
    : date || null;

  return (
    <Card className="craft-card mb-2 flex h-full w-full flex-col">
      <div className="flex w-full flex-col gap-3 p-3.5">
        <div className="flex gap-3">
          <Skeleton
            loading={isLoading}
            className="size-10 shrink-0 rounded-full"
          >
            <img
              src={tokenIcon || '/placeholder/token-icon.svg'}
              alt={tTreasury('transactionCard.tokenIconAlt')}
              className="size-10 rounded-full object-cover"
            />
          </Skeleton>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {symbol ? (
                  <Badge
                    isLoading={isLoading}
                    size={1}
                    variant="outline"
                    colorVariant="neutral"
                  >
                    {symbol}
                  </Badge>
                ) : null}
                <Badge
                  isLoading={isLoading}
                  size={1}
                  variant="outline"
                  colorVariant="neutral"
                >
                  {isMint
                    ? tTreasury('transactionCard.type.mint')
                    : isBurn()
                    ? tTreasury('transactionCard.type.burn')
                    : tTreasury('transactionCard.type.transfer')}
                </Badge>
                <Badge
                  isLoading={isLoading}
                  size={1}
                  variant="soft"
                  colorVariant={
                    isMint || direction === 'incoming' ? 'success' : 'error'
                  }
                >
                  {counterparty === 'from'
                    ? tTreasury('transactionCard.direction.in')
                    : tTreasury('transactionCard.direction.out')}
                </Badge>
              </div>
              <Amount isLoading={isLoading} value={value} />
              {hasCounterparty ? (
                <Skeleton loading={isLoading} width="80px" height="16px">
                  <p className="craft-meta truncate">
                    {displayName
                      ? counterparty === 'from'
                        ? tTreasury('transactionCard.counterparty.from', {
                            name: displayName,
                          })
                        : tTreasury('transactionCard.counterparty.to', {
                            name: displayName,
                          })
                      : null}
                  </p>
                </Skeleton>
              ) : null}
            </div>
            <Skeleton width="96px" height="16px" loading={isLoading}>
              <div className="craft-meta flex shrink-0 items-center">
                <CalendarIcon className="mr-1 size-3.5" />
                <span className="whitespace-nowrap text-1">
                  {formattedDate}
                </span>
              </div>
            </Skeleton>
          </div>
        </div>

        {memo ? (
          <div className="craft-meta border-t border-border/70 pt-3 text-2">
            {tTreasury('transactionCard.memo')}:{' '}
            <span className="text-foreground/80">{memo}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
};
