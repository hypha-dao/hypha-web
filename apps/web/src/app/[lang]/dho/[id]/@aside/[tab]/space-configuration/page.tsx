import { getEnableNetworkMapAsync } from '@hypha-platform/feature-flags';
import { SpaceConfigurationClient } from './space-configuration-client';

export default async function SpaceConfiguration() {
  const enableNetworkMap = await getEnableNetworkMapAsync();
  return <SpaceConfigurationClient enableNetworkMap={enableNetworkMap} />;
}
