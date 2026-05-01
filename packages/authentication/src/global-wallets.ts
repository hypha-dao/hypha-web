export const LOCAL_SCALE_GLOBAL_WALLET_APP_ID = 'cmhuvof94005fky0dhm6cfxvg';

export const toPrivyGlobalWalletLoginMethod = (providerAppId: string) =>
  `privy:${providerAppId}` as const;
