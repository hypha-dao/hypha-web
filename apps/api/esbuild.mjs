import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  platform: 'node',
  format: 'esm',
  minify: true,
  treeShaking: true,
  bundle: true,
  packages: 'external',
});
