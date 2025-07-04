export interface TransferWithPerson {
  transactionHash: string;
  from: string;
  to: string;
  value: number;
  symbol: string;
  timestamp: string;
  person?: {
    name?: string;
    surname?: string;
    avatarUrl?: string;
  };
  direction: 'incoming' | 'outgoing';
  counterparty: 'from' | 'to';
}
