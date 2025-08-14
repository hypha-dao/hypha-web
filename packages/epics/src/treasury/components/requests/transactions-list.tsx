import { FC } from 'react';
import { TransferCard } from './transfer-card';
import { TransferWithEntity } from '../../hooks';

type TransactionsListProps = {
  transfers: TransferWithEntity[];
  activeSort: string;
  isLoading?: boolean;
};

export const TransactionsList: FC<TransactionsListProps> = ({
  transfers,
  activeSort,
  isLoading,
}) => {
  return (
    <div className="w-full mt-2">
      {transfers.map((transfer, index) => (
        <TransferCard
          key={`${transfer.transactionHash}-${index}`}
          name={transfer.person?.name}
          surname={transfer.person?.surname}
          title={transfer.space?.title}
          avatar={transfer.person?.avatarUrl || transfer.space?.avatarUrl}
          value={transfer.value}
          symbol={transfer.symbol}
          date={transfer.timestamp}
          isLoading={isLoading}
          direction={transfer.direction}
          counterparty={transfer.counterparty}
          isMint={
            transfer.from === '0x0000000000000000000000000000000000000000'
          }
        />
      ))}
      {isLoading && (
        <div className="w-full grid grid-cols-1 gap-2 mt-2">
          <TransferCard isLoading={isLoading} />
          <TransferCard isLoading={isLoading} />
          <TransferCard isLoading={isLoading} />
          <TransferCard isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};
