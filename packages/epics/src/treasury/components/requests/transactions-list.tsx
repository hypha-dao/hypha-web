import { FC } from 'react';
import { RequestCard } from './request-card';
import { TransferWithPerson } from '../../hooks';

type TransactionsListProps = {
  transfers: TransferWithPerson[];
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
        <RequestCard
          key={`${transfer.transactionHash}-${index}`}
          name={transfer.person?.name}
          surname={transfer.person?.surname}
          avatar={transfer.person?.avatarUrl}
          value={transfer.value}
          symbol={transfer.symbol}
          date={transfer.timestamp}
          isLoading={isLoading}
        />
      ))}
      {isLoading && (
        <div className="w-full grid grid-cols-1 gap-2 mt-2">
          <RequestCard isLoading={isLoading} />
          <RequestCard isLoading={isLoading} />
          <RequestCard isLoading={isLoading} />
          <RequestCard isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};
