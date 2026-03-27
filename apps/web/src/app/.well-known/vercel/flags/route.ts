import { createFlagsDiscoveryEndpoint, getProviderData } from 'flags/next';
import * as flags from '@hypha-platform/feature-flags';

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return getProviderData(flags);
});
