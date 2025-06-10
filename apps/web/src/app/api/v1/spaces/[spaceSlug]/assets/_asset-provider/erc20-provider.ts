import { AssetProvider, ProviderOpts, Balance } from './interface';
import { Hex, formatUnits } from 'viem';
import { AssetItem } from '@hypha-platform/graphql/rsc';

export type TokenType = ('voice' | 'ownership' | 'utility' | 'credits') &
  string;

export type Erc20ProviderOpts = ProviderOpts & {
  token: Hex;
  status?: TokenType;
  name?: string;
};

export class Erc20Provider implements AssetProvider {
  private readonly token: Hex;
  private readonly name: string;
  private readonly icon: string;
  private readonly status: TokenType;
  private readonly closeUrl: string;
  private readonly slug: string;
  private readonly getBalance: (address: Hex) => Promise<Balance>;
  private readonly usdEquivalent: (amount: number) => Promise<number>;

  constructor(opts: Erc20ProviderOpts) {
    this.token = opts.token;
    this.name = opts.name || '';
    this.icon = opts.icon || '';
    this.status = opts.status || 'utility';
    this.closeUrl = opts.closeUrl || '';
    this.slug = opts.slug;
    this.getBalance = opts.getBalance;
    this.usdEquivalent =
      opts.usdEquivalent ||
      function () {
        return new Promise((resolve, _) => resolve(0));
      };
  }

  async formItem(address: Hex): Promise<AssetItem> {
    const { amount, symbol, decimals } = await this.getBalance(address);
    const value = +formatUnits(amount as bigint, decimals as number);

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
    };
  }
}
