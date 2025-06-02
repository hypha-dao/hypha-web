import { AssetProvider, ProviderOpts } from './interface';
import { PublicClient, Hex, formatUnits } from 'viem';
import { AssetItem } from '@hypha-platform/graphql/rsc';

export class EthereumProvider implements AssetProvider {
  private readonly client: PublicClient;
  private readonly icon: string;
  private readonly status = 'liquid';
  private readonly name = 'Ethereum';
  private readonly symbol = 'ETH';
  private readonly decimals = 18;
  private readonly slug: string;
  private readonly closeUrl: string;
  private readonly usdEquivalent: (amount: number) => Promise<number>;

  constructor(
    opts: ProviderOpts,
  ) {
    this.client = opts.client;
    this.icon = opts.icon || '/placeholder/eth.png';
    this.slug = opts.slug;
    this.closeUrl = opts.closeUrl || '';
    this.usdEquivalent = opts.usdEquivalent || function() {
      return new Promise((resolve, _) => resolve(0));
    }
  }

  async formItem(address: Hex): Promise<AssetItem> {
    const balance = await this.client.getBalance({
      blockTag: 'safe',
      address,
    });
    const amount = +formatUnits(balance, this.decimals);

    return {
      icon: this.icon,
      name: this.name,
      symbol: this.symbol,
      value: amount,
      usdEqual: await this.usdEquivalent(amount),
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
