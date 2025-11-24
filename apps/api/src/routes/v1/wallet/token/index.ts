import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';
import { erc20Abi, formatUnits, isAddress } from 'viem';

export default async function tokenRoutes(app: FastifyInstance) {
  /**
   * @summary Fetches transactions of a user by specified token
   */
  app.get<Schema>('/:id', { schema }, async (req) => {
    const authToken = req.headers.authorization?.split(' ').at(1);
    // TODO: implement proper return
    if (authToken == null) throw new Error('Unauthorized');

    const userAddress = (await app.db.findPersonByAuth({ authToken }))?.address;
    // TODO: implement proper return
    if (userAddress == null) throw new Error('User not found');

    const { id } = req.params;
    const token = await app.db.findTokenById({ id });
    // TODO: implement proper return
    if (token == null) throw new Error('Token not found');
    if (token.address == null)
      throw new Error('Token does not have an address');

    const [balance, decimals] = await app.web3Client.multicall({
      contracts: [
        {
          abi: erc20Abi,
          address: token.address as `0x${string}`,
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`],
        },
        {
          abi: erc20Abi,
          address: token.address as `0x${string}`,
          functionName: 'decimals',
          args: [],
        },
      ],
    });
    const userBalance =
      balance.status === 'success' && decimals.status === 'success'
        ? +formatUnits(balance.result, decimals.result)
        : 0;

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

    const transfers = await app.alchemy.getAssetTransfers({
      address: userAddress as `0x${string}`,
      contracts: [token.address as `0x${string}`],
      limit: req.query.limit,
    });

    const userAddresses = transfers
      .map(({ to, from, direction }) => (direction === 'income' ? from : to))
      .filter((address) => address != null && isAddress(address))
      .filter((address, i, self) => self.indexOf(address) == i);
    const { data: unorderedPeople } = await app.db.peopleByAddresses({
      addresses: userAddresses,
      pagination: { pageSize: userAddresses.length },
    });
    const people = new Map(
      unorderedPeople
        .filter((person) => person.address != null)
        .map((person) => [person.address as string, person]),
    );

    const transactions = transfers.map((transfer) => {
      const base = {
        direction: transfer.direction,
        amount: transfer.amount ?? 0,
        symbol: transfer.symbol ?? 'UNKNOWN',
        timestamp: transfer.timestamp.toISOString(),
      };

      const address =
        transfer.direction === 'income' ? transfer.from : transfer.to;
      if (address == null)
        return {
          ...base,
          username: address || 'Unknown user',
          avatar_url: null,
        };
      const person = people.get(address);

      return {
        ...base,
        username: person?.name || address || 'Unknown user',
        avatar_url: person?.avatarUrl ?? null,
      };
    });

    const base = {
      name: token.name,
      symbol: token.symbol,
      balance: userBalance,
      icon_url: token.iconUrl,
      transactions,
    };

    switch (token.type) {
      case 'voice':
      case 'ownership': {
        const supply = token.address
          ? await getSupply(token.address as `0x${string}`)
          : 0;
        return {
          ...base,
          percentage: supply > 0 ? (100 * base.balance) / supply : 0,
        };
      }

      default:
        return base;
    }
  });
}
