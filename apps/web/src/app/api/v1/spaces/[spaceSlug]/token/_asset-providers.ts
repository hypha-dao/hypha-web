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
  icon?: string;
  name?: string;
  status?: TokenType
  closeUrl?: string;
  slug: string;
}

export class EthereumProvider implements AssetProvider {
  private readonly icon: string;
  private readonly status = 'liquid';
  private readonly name = 'Ethereum';
  private readonly symbol = 'ETH';
  private readonly decimals = 18;
  private readonly slug: string;
  private readonly closeUrl: string;

  constructor(
    private readonly client: PublicClient,
    opts: Omit<ProviderOpts, "status" | "name">,
  ) {
    this.icon = opts.icon || '/placeholder/eth.png';
    this.slug = opts.slug;
    this.closeUrl = opts.closeUrl || '';
  }

  async formItem(address: Hex): Promise<AssetItem> {
    const balance = await this.client.getBalance({
      blockTag: 'safe',
      address,
    });

    return {
      icon: this.icon,
      name: this.name,
      symbol: this.symbol,
      value: +formatUnits(balance, this.decimals),
      // TODO: get USD equal
      usdEqual: 0,
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
  private readonly name: string;
  private readonly icon: string;
  private readonly status: TokenType;
  private readonly closeUrl: string;
  private readonly slug: string;

  constructor(
    private readonly client: PublicClient,
    private readonly token: Hex,
    opts: ProviderOpts,
  ) {
    this.name = opts.name || '';
    this.icon = opts.icon || '';
    this.status = opts.status || 'utility';
    this.closeUrl = opts.closeUrl || '';
    this.slug = opts.slug;
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

    const [amount, symbol, decimals] = balance.map(obj => obj.result);
    return {
      icon: this.icon,
      name: this.name,
      symbol: String(symbol),
      value: +formatUnits((amount as bigint), (decimals as number)),
      // TODO: get USD equal
      usdEqual: 0,
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
