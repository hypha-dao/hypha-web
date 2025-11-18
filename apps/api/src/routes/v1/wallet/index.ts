import type { FastifyInstance } from 'fastify';
import { response, type Response } from './schema/get-wallet';
import { erc20Abi, formatUnits, isAddress } from 'viem';

export default async function walletRoutes(app: FastifyInstance) {
  /**
   * GET /wallet/receive
   */
  app.get('/receive', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * POST /wallet/send
   */
  app.post('/send', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /wallet/recipients
   */
  app.get('/recipients', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /wallet/tokens/:id
   */
  app.get('/tokens/:id', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /wallet
   */
  app.get<{ Reply: Response }>(
    '/',
    {
      schema: { response: { 200: response } },
    },
    async () => {
      // TODO: find user's address
      const userAddress = '0x';
      const rawBalances = await app.alchemy.getTokenBalanceByAddress(
        userAddress,
      );

      const tokenAddresses = rawBalances
        .map(({ tokenAddress }) => tokenAddress)
        .filter((address) => isAddress(address));
      const fetchingDbTokens = app.db.findTokensByAddresses({
        addresses: tokenAddresses,
      });

      const balances = new Map(
        rawBalances.map(({ tokenAddress, balance }) => [
          tokenAddress.toLowerCase(),
          balance,
        ]),
      );

      const utility_tokens: Response['utility_tokens'] = [];
      const voice_tokens: Response['voice_tokens'] = [];
      const ownership_tokens: Response['ownership_tokens'] = [];

      const getSupply = async (address: `0x${string}`) => {
        const baseContract = {
          address,
          abi: erc20Abi,
        } as const;

        const [supply, decimals] = await app.web3Client.multicall({
          contracts: [
            { ...baseContract, functionName: 'totalSupply', args: [] },
            { ...baseContract, functionName: 'decimals', args: [] },
          ],
        });

        if (supply.status === 'failure' || decimals.status === 'failure') {
          return 0;
        }

        return Number(formatUnits(supply.result, decimals.result));
      };

      const formingResults = (await fetchingDbTokens).map(async (token) => {
        const normalizedAddress = token.address?.toLowerCase();
        const balance =
          normalizedAddress != null ? balances.get(normalizedAddress) ?? 0 : 0;

        const base = {
          balance,
          name: token.name,
          symbol: token.symbol,
          icon_url: token.iconUrl,
        };

        switch (token.type) {
          case 'voice': {
            const supply =
              token.address != null
                ? await getSupply(token.address as `0x${string}`)
                : 0;
            const percentage = supply > 0 ? (100 * balance) / supply : 0;
            voice_tokens.push({ ...base, percentage });
            break;
          }

          case 'ownership': {
            const supply =
              token.address != null
                ? await getSupply(token.address as `0x${string}`)
                : 0;
            const percentage = supply > 0 ? (100 * balance) / supply : 0;
            ownership_tokens.push({ ...base, percentage });
            break;
          }

          default:
            utility_tokens.push(base);
        }
      });
      await Promise.all(formingResults);

      return { utility_tokens, voice_tokens, ownership_tokens };
    },
  );
}
