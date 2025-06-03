import { AssetItem } from '@hypha-platform/graphql/rsc';
import { Hex } from 'viem';

export interface AssetProvider {
  // Should provide all necessary info about the asset with a balance for the
  // "address"
  formItem(address: Hex): Promise<AssetItem>;
};
