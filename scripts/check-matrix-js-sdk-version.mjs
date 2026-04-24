#!/usr/bin/env node
/**
 * Ensures the resolved matrix-js-sdk major version is 40.x (Hypha policy: ^40.0.0; no v41+ in Next until upgraded).
 * Run from repo root: node scripts/check-matrix-js-sdk-version.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const packageJsonCandidates = [
  join(root, 'node_modules', 'matrix-js-sdk', 'package.json'),
  join(root, 'apps', 'web', 'node_modules', 'matrix-js-sdk', 'package.json'),
  join(root, 'packages', 'core', 'node_modules', 'matrix-js-sdk', 'package.json'),
  join(root, 'packages', 'epics', 'node_modules', 'matrix-js-sdk', 'package.json'),
];

let pkg;
for (const p of packageJsonCandidates) {
  try {
    pkg = require(p);
    break;
  } catch {
    // try next
  }
}
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
