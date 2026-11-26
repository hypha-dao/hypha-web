# `@hypha-platform/config-vitest`

Shared Vitest settings. Each package with unit tests has a `vitest.config.ts`:

```ts
import { defineUnitConfig } from '@hypha-platform/config-vitest';

export default defineUnitConfig({
  // package-specific settings only
});
```

Conventions (where tests live, naming, tiers, CI): [`docs/development/testing.md`](../../docs/development/testing.md).
