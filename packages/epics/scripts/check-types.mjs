import { createRequire } from 'node:module';
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const epicsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = join(epicsRoot, '../core');
const coreNodeModules = join(coreRoot, 'node_modules');
const coreNodeModulesBackup = join(coreRoot, 'node_modules.__epics_check_types_bak__');

function resolveFromCore(specifier) {
  try {
    return createRequire(join(coreRoot, 'package.json')).resolve(specifier);
  } catch {
    return null;
  }
}

function resolvePackageRoot(specifier) {
  const entry = resolveFromCore(specifier);
  if (!entry) return null;

  let dir = dirname(entry);
  const stopAt = join(coreRoot, '..', '..');
  while (dir.startsWith(stopAt) && dir !== stopAt) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (pkg.name === specifier) {
          return dir;
        }
      } catch {
        // Keep walking up the tree.
      }
    }
    dir = dirname(dir);
  }

  return null;
}

function toEpicsPath(absolutePath) {
  return relative(epicsRoot, absolutePath).replaceAll('\\', '/');
}

function restoreCoreNodeModules() {
  if (!existsSync(coreNodeModulesBackup)) return;
  try {
    rmSync(coreNodeModules, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
  renameSync(coreNodeModulesBackup, coreNodeModules);
}

const baseTsconfig = JSON.parse(
  readFileSync(join(epicsRoot, 'tsconfig.json'), 'utf8'),
);

const mergedPaths = {
  ...(baseTsconfig.compilerOptions?.paths ?? {}),
};

for (const specifier of [
  '@privy-io/node',
  '@openrouter/ai-sdk-provider',
]) {
  const packageRoot = resolvePackageRoot(specifier);
  if (packageRoot) {
    mergedPaths[specifier] = [toEpicsPath(packageRoot)];
  }
}

writeFileSync(
  join(epicsRoot, 'tsconfig.check-types.json'),
  `${JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: {
        baseUrl: '.',
        paths: mergedPaths,
      },
    },
    null,
    2,
  )}\n`,
);

try {
  rmSync(coreNodeModulesBackup, { recursive: true, force: true });
  if (existsSync(coreNodeModules)) {
    renameSync(coreNodeModules, coreNodeModulesBackup);
  }
} catch {
  restoreCoreNodeModules();
  process.exit(1);
}

const tsc = join(epicsRoot, '../../node_modules/typescript/bin/tsc');
const result = spawnSync(
  tsc,
  ['--noEmit', '-p', 'tsconfig.check-types.json'],
  {
    cwd: epicsRoot,
    stdio: 'inherit',
  },
);

restoreCoreNodeModules();
process.exit(result.status ?? 1);
