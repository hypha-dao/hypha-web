import { type Alchemy, TokenBalanceType } from 'alchemy-sdk';
import { formatUnits } from 'viem';

export function newGetTokenBalanceByAddress(client: Alchemy) {
  return async function getTokenBalanceByAddress(address: `0x${string}`) {
    const balances = await client.core.getTokenBalances(address, {
      type: TokenBalanceType.ERC20,
    });
    const nonEmptyBalances = {
      ...balances,
      tokenBalances: balances.tokenBalances.filter(
        // Despite type `string | null` value isn't null
        (balance) => balance.error == null,
      ),
    };

    const tokensWithMetadata = await Promise.all(
      nonEmptyBalances.tokenBalances.map(async (balance) => {
        try {
          const { decimals, symbol, name, logo } =
            await client.core.getTokenMetadata(balance.contractAddress);
          if (decimals == null) {
            return;
          }

          const stringRepresentation = formatUnits(
            BigInt(balance.tokenBalance),
            decimals,
          );
          const numberRepresentation = Number(stringRepresentation);
          if (isNaN(numberRepresentation)) {
            return;
          }

          return {
            tokenAddress: balance.contractAddress,
            balance: numberRepresentation,
            symbol,
            name,
            logo,
          };
        } catch (error) {
          console.warn(
            `Failed to fetch metadata for token ${balance.contractAddress}:`,
            error,
          );
        }
      }),
    );

    return tokensWithMetadata.filter((token) => token != null);
  };
}
