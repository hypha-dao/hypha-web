import { AssetItem } from '@hypha-platform/graphql/rsc';
import { Hex } from 'viem';

export type Balance = {
  amount: bigint;
  symbol: string;
  decimals: number;
};

export type ProviderOpts = {
  slug: string;
  icon?: string;
  closeUrl?: string;

  // Method to get the balance of the address
  getBalance: (address: Hex) => Promise<Balance>;

  // Method to convert amount of provided token to its USD equivalent
  usdEquivalent?: (amount: number) => Promise<number>;
};

export interface AssetProvider {
  // Should provide all necessary info about the asset with a balance for the
  // "address"
  formItem(address: Hex): Promise<AssetItem>;
}
