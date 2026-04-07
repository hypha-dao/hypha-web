export interface TransferWithEntity {
  transactionHash: string;
  from: string;
  to: string;
  value: number;
  symbol: string;
  timestamp: string;
  contractAddress?: `0x${string}`;
  person?: {
    name?: string;
    surname?: string;
    avatarUrl?: string;
  };
  space?: {
    title?: string;
    avatarUrl?: string;
  };
  tokenIcon?: string;
  direction: 'incoming' | 'outgoing';
  counterparty: 'from' | 'to';
  memo?: string;
}
