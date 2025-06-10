import { AssetProvider, ProviderOpts, Balance } from './interface';
import { Hex, formatUnits } from 'viem';
import { AssetItem } from '@hypha-platform/graphql/rsc';

export class EthereumProvider implements AssetProvider {
  private readonly icon: string;
  private readonly status = 'liquid';
  private readonly name = 'Ethereum';
  private readonly slug: string;
  private readonly closeUrl: string;
  private readonly getBalance: (address: Hex) => Promise<Balance>;
  private readonly usdEquivalent: (amount: number) => Promise<number>;

  constructor(opts: ProviderOpts) {
    this.icon = opts.icon || '/placeholder/eth.png';
    this.slug = opts.slug;
    this.closeUrl = opts.closeUrl || '';
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
      symbol: symbol,
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
