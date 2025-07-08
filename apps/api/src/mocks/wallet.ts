import {
  ReceiveTokenResponse,
  SendTokenResponse,
  RecipientsResponse,
  TokenBalanceResponse,
  WalletBalancesResponse,
} from '../types/v1/generated';

export const receiveTokenMock: ReceiveTokenResponse = {
  token_id: 1,
  network: 'base',
  address: '0x4200000000000000000000000000000000000006',
  qr_code_url: 'https://example.com/qr.png',
};

export const sendTokenMock: SendTokenResponse = {
  message: 'Transfer successful',
  transaction_id:
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  timestamp: '2023-11-10T12:00:00Z',
  status: 'success',
};

export const recipientsMock: RecipientsResponse = {
  recipients: [
    {
      username: 'alice',
      avatar_url: 'https://example.com/alice.png',
      key: 'alice-key',
    },
    {
      username: 'bob',
      avatar_url: 'https://example.com/bob.png',
      key: 'bob-key',
    },
    {
      username: 'john',
      avatar_url: 'https://example.com/john.png',
      key: 'john-key',
    },
  ],
};

export const tokenBalanceMock: TokenBalanceResponse = {
  name: 'Hypha Token',
  symbol: 'HYP',
  balance: 1000,
  icon_url: 'https://example.com/token.png',
  transactions: [
    {
      username: 'alice',
      avatar_url: 'https://example.com/alice.png',
      direction: 'income',
      amount: 100,
      symbol: 'HYP',
      timestamp: '2023-11-09T10:00:00Z',
    },
    {
      username: 'bob',
      avatar_url: 'https://example.com/bob.png',
      direction: 'payment',
      amount: 50,
      symbol: 'HYP',
      timestamp: '2023-11-08T09:00:00Z',
    },
  ],
};

export const walletBalancesMock: WalletBalancesResponse = {
  utility_tokens: [
    {
      name: 'Utility Token',
      symbol: 'UTIL',
      balance: 500,
      icon_url: 'https://example.com/util.png',
    },
  ],
  ownership_tokens: [
    {
      name: 'Ownership Token',
      symbol: 'OWN',
      balance: 200,
      icon_url: 'https://example.com/own.png',
      percentage: 20,
    },
  ],
  voice_tokens: [
    {
      name: 'Voice Token',
      symbol: 'VOICE',
      balance: 300,
      icon_url: 'https://example.com/voice.png',
      percentage: 30,
    },
  ],
};
