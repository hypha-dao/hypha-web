import { AssetProvider } from './_interface';
import { PublicClient, Hex, formatUnits } from 'viem';
import { AssetItem } from '@hypha-platform/graphql/rsc';
import { ERC20 } from './_abis';

// TODO: move to a more appropriate file
export type TokenType = (
  | 'voice'
  | 'ownership'
  | 'utility'
  | 'credits'
) & string;

export type ProviderOpts = {
  client: PublicClient,
  slug: string;
  token: Hex;
  icon?: string;
  name?: string;
  status?: TokenType
  closeUrl?: string;
  // Async funtion to convert current amount of tokens to its USD equivalent
  usdEquivalent?: (amount: number) => Promise<number>;
}

export class EthereumProvider implements AssetProvider {
  private readonly client: PublicClient;
  private readonly icon: string;
  private readonly status = 'liquid';
  private readonly name = 'Ethereum';
  private readonly symbol = 'ETH';
  private readonly decimals = 18;
  private readonly slug: string;
  private readonly closeUrl: string;
  private getUsdEquivalent: (amount: number) => Promise<number>;

  constructor(opts: Omit<ProviderOpts, "status" | "name" | "token">) {
    this.client = opts.client;
    this.icon = opts.icon || '/placeholder/eth.png';
    this.slug = opts.slug;
    this.closeUrl = opts.closeUrl || '';
    this.getUsdEquivalent = opts.usdEquivalent || function(_: number) {
      return new Promise((resolve, _) => resolve(0));
    };
  }

  async formItem(address: Hex): Promise<AssetItem> {
    const balance = await this.client.getBalance({
      blockTag: 'safe',
      address,
    });
    const amount = +formatUnits(balance, this.decimals);

    let usdEqual: number;
    try {
      usdEqual = await this.getUsdEquivalent(amount)
    } catch (error) {
      console.error(`Failed to get USD equivalent for ${this.symbol}:`, error)
      usdEqual = 0;
    }

    return {
      icon: this.icon,
      name: this.name,
      symbol: this.symbol,
      value: amount,
      usdEqual: usdEqual,
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

export class Erc20Provider implements AssetProvider {
  private readonly client: PublicClient;
  private readonly token: Hex;
  private readonly name: string;
  private readonly icon: string;
  private readonly status: TokenType;
  private readonly closeUrl: string;
  private readonly slug: string;
  private getUsdEquivalent: (amount: number) => Promise<number>;

  constructor(opts: ProviderOpts) {
    this.slug = opts.slug;
    this.client = opts.client;
    this.token = opts.token;
    this.name = opts.name || '';
    this.icon = opts.icon || '';
    this.status = opts.status || 'utility';
    this.closeUrl = opts.closeUrl || '';
    this.getUsdEquivalent = opts.usdEquivalent || function(_) {
      return new Promise((resolve, _) => resolve(0));
    }
  }

  async formItem(address: Hex): Promise<AssetItem> {
    const contract = {
      address: this.token,
      abi: ERC20,
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

    const [value, symbol, decimals] = balance.map(obj => obj.result);
    const amount = +formatUnits((value as bigint), (decimals as number));
    let usdEqual: number;
    try {
      usdEqual = await this.getUsdEquivalent(amount)
    } catch (error) {
      console.error(`Failed to get USD equivalent for ${symbol}:`, error)
      usdEqual = 0;
    }

    return {
      icon: this.icon,
      name: this.name,
      symbol: String(symbol),
      value: amount,
      usdEqual: usdEqual,
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
