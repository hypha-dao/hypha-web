export const CONNECT_SOURCES = [
  'https://auth.privy.io',
  'wss://relay.walletconnect.com',
  'wss://relay.walletconnect.org',
  'wss://www.walletlink.org',
  'https://*.rpc.privy.systems',
  'https://explorer-api.walletconnect.com',
  'https://pulse.walletconnect.org',
  'https://api.web3modal.org',
  process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org',
];
