import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  platform: 'node',
  format: 'esm',
  minify: true,
  treeShaking: true,
  bundle: true,
  packages: 'external',
  plugins: [
    copy({
      assets: {
        from: ['./docs/v1/*'],
        to: ['.'],
      },
    }),
  ],
  alias: { 'server-only': 'server-only' },
});
