// SPIKE (hypha-web#2559): bundle v2-spike.ts so Node never has to load the
// workspace packages as CJS-from-ESM (it cannot see `export *` names there).
// Uses the esbuild that tsx already depends on. Throwaway: not meant to merge.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tsxDir = require.resolve('tsx/package.json');
const esbuild = require(require.resolve('esbuild', { paths: [tsxDir] }));

await esbuild.build({
  entryPoints: ['src/v2-spike.ts'],
  outfile: 'dist-spike/v2-spike.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // `server-only` throws outside a React server build; use its empty module.
  alias: {
    'server-only': fileURLToPath(
      new URL('./node_modules/server-only/empty.js', import.meta.url),
    ),
  },
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url); import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);",
  },
  // Optional native add-ons that pg/ws probe for; absent is fine.
  external: ['pg-native', 'bufferutil', 'utf-8-validate'],
  logLevel: 'info',
});
