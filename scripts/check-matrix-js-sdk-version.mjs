#!/usr/bin/env node
/**
 * Ensures the resolved matrix-js-sdk major version is 40.x (Hypha policy: ^40.0.0; no v41+ in Next until upgraded).
 * Also fails if `apps/web` vs `packages/*` resolve different `matrix-js-sdk` versions.
 * Run from repo root: node scripts/check-matrix-js-sdk-version.mjs (root `pnpm run lint` runs this first)
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
/** `matrix-js-sdk` is a direct dep of `apps/web` and workspace packages, not the root. */
const requireResolvers = [
  createRequire(join(root, 'apps', 'web', 'package.json')),
  createRequire(join(root, 'packages', 'epics', 'package.json')),
  createRequire(join(root, 'packages', 'core', 'package.json')),
];

function readMatrixPackageJson() {
  const byVersion = new Map();
  for (const req of requireResolvers) {
    try {
      const entry = req.resolve('matrix-js-sdk');
      const installRoot = resolve(dirname(entry), '..');
      const pkg = JSON.parse(
        readFileSync(join(installRoot, 'package.json'), 'utf8'),
      );
      byVersion.set(pkg.version || 'unknown', installRoot);
    } catch {
      /* try next */
    }
  }
  if (byVersion.size === 0) return null;
  if (byVersion.size > 1) {
    const lines = [...byVersion.entries()].map(
      ([v, root]) => `  ${v} — ${root}`,
    );
    console.error(
      'check-matrix-js-sdk-version: multiple matrix-js-sdk versions resolved:\n' +
        lines.join('\n'),
    );
    process.exit(1);
  }
  const [version, installRoot] = [...byVersion.entries()][0];
  return { version, installRoot };
}

const pkg = readMatrixPackageJson();
if (!pkg) {
  console.error(
    'check-matrix-js-sdk-version: matrix-js-sdk not found. Run `pnpm install` from the repo root (expect hoisted or apps/web link).',
  );
  process.exit(1);
}

const version = pkg.version || '';
const major = Number.parseInt(version.split('.')[0] || '0', 10);

if (Number.isNaN(major) || major !== 40) {
  console.error(
    `check-matrix-js-sdk-version: expected matrix-js-sdk major 40 (got ${version || 'unknown'}).`,
  );
  console.error('See docs/requirements/voice-video-call-phase-0-runbook.md and package.json ^40.0.0.');
  process.exit(1);
}

console.log(`check-matrix-js-sdk-version: OK (matrix-js-sdk@${version})`);
process.exit(0);
