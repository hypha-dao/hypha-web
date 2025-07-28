import 'server-only';
import NodeCache from 'node-cache';

const priceCache = new NodeCache({ stdTTL: 300 });

export async function getTokenPrice(
  tokens: `0x${string}`[],
  chainId = '0x2105',
) {
  const platform = chainId === '0x2105' ? 'base' : 'ethereum';
  const results: Record<string, number> = {};

  const tokensToFetch: `0x${string}`[] = [];
  tokens.forEach((token) => {
    const cachedPrice = priceCache.get<number>(
      `${platform}_${token.toLowerCase()}`,
    );
    if (cachedPrice !== undefined) {
      results[token] = cachedPrice;
    } else {
      tokensToFetch.push(token);
    }
  });

  if (tokensToFetch.length === 0) {
    return results;
  }

  try {
    for (const token of tokensToFetch) {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${token.toLowerCase()}&vs_currencies=usd`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json();
      const price = data[token.toLowerCase()]?.usd || 0;

      priceCache.set(`${platform}_${token.toLowerCase()}`, price);
      results[token] = price;
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    tokensToFetch.forEach((token) => {
      results[token] = results[token] || 0;
    });
    return results;
  }
}
