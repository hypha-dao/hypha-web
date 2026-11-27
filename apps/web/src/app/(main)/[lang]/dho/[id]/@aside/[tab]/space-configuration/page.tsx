import {
  getEnableNetworkMapAsync,
  getEnableSpaceMemory,
} from '@hypha-platform/feature-flags';
import { SpaceConfigurationClient } from './space-configuration-client';

export default async function SpaceConfiguration() {
  const [enableNetworkMap, memoryEnabled] = await Promise.all([
    getEnableNetworkMapAsync(),
    getEnableSpaceMemory(),
  ]);
  return (
    <SpaceConfigurationClient
      enableNetworkMap={enableNetworkMap}
      memoryEnabled={memoryEnabled}
    />
  );
}
