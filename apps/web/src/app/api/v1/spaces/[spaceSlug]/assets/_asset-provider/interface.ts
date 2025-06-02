import { AssetItem } from '@hypha-platform/graphql/rsc';
import { Hex, PublicClient } from 'viem';

export type ProviderOpts = {
  client: PublicClient;
  slug: string;
  icon?: string;
  closeUrl?: string;

  // Method to convert amount of provided token to its USD equivalent
  usdEquivalent?: (amount: number) => Promise<number>;
}

export interface AssetProvider {
  // Should provide all necessary info about the asset with a balance for the
  // "address"
  formItem(address: Hex): Promise<AssetItem>;
};
