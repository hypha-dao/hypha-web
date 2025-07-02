import 'server-only';

import { getMoralis } from './moralis-client';

export async function getTokenPrice(
  tokens: `0x${string}`[],
  chainId = '0x2105',
) {
  const moralis = await getMoralis();

  const { result } = await moralis.EvmApi.token.getMultipleTokenPrices(
    { chain: chainId },
    {
      tokens: tokens.map((token) => ({ tokenAddress: token })),
    },
  );

  return Object.fromEntries(
    tokens.map((token) => [
      token,
      result.find(
        (r) =>
          r.tokenAddress === token || r.tokenAddress === token.toLowerCase(),
      )?.usdPrice,
    ]),
  );
}
