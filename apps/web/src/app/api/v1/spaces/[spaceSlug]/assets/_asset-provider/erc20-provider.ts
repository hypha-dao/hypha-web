import { AssetProvider, ProviderOpts } from './interface';
import { erc20Abi, PublicClient, Hex, formatUnits } from 'viem';
import { AssetItem } from '@hypha-platform/graphql/rsc';

export type TokenType = (
  | 'voice'
  | 'ownership'
  | 'utility'
  | 'credits'
) & string;

export type Erc20ProviderOpts = ProviderOpts & {
  token: Hex,
  status?: TokenType,
  name?: string,
};

export class Erc20Provider implements AssetProvider {
  private readonly client: PublicClient;
  private readonly token: Hex;
  private readonly name: string;
  private readonly icon: string;
  private readonly status: TokenType;
  private readonly closeUrl: string;
  private readonly slug: string;
  private readonly usdEquivalent: (amount: number) => Promise<number>;

  constructor(
    opts: Erc20ProviderOpts,
  ) {
    this.client = opts.client;
    this.token = opts.token;
    this.name = opts.name || '';
    this.icon = opts.icon || '';
    this.status = opts.status || 'utility';
    this.closeUrl = opts.closeUrl || '';
    this.slug = opts.slug;
    this.usdEquivalent = opts.usdEquivalent || function() {
      return new Promise((resolve, _) => resolve(0));
    }
  }

  async formItem(address: Hex): Promise<AssetItem> {
    const contract = {
      address: this.token,
      abi: erc20Abi,
    } as const;

    const balance = await this.client.multicall({
      contracts: [
        {
          ...contract,
          functionName: 'balanceOf',
          args: [address],
        },
        {
          ...contract,
          functionName: 'symbol',
        },
        {
          ...contract,
          functionName: 'decimals',
        }
      ]
    })

    const failure = balance.find(res => res.status === "failure");
    if (failure) {
      throw failure.error;
    }

    const [amount, symbol, decimals] = balance.map(obj => obj.result);
    const value = +formatUnits((amount as bigint), (decimals as number));
    return {
      icon: this.icon,
      name: this.name,
      symbol: String(symbol),
      value: value,
      usdEqual: await this.usdEquivalent(value),
      status: this.status,
      // TODO: get chart data
      chartData: [],
      // TODO: get transactions
      transactions: [],
      closeUrl: this.closeUrl,
      slug: this.slug,
    }
  }
}
