import { createFlagsDiscoveryEndpoint } from 'flags/next';
import { flagDefinitionsForDiscovery } from '@hypha-platform/feature-flags';

export const GET = createFlagsDiscoveryEndpoint(async () => {
  const definitions = Object.fromEntries(
    Object.values(flagDefinitionsForDiscovery).map((def) => [
      def.key,
      {
        options: def.options,
        origin: def.origin,
        description: def.description,
        defaultValue: def.defaultValue,
        declaredInCode: true,
      },
    ]),
  );
  return { definitions, hints: [] };
});
