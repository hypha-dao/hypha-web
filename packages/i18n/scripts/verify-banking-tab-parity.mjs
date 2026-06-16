#!/usr/bin/env node
/**
 * Ensures `BankingTab` keys match across every locale JSON under `src/messages`.
 * Uses `en.json` as the canonical key set.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'src', 'messages');
const files = fs
  .readdirSync(messagesDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

/** @param {unknown} v @param {string} prefix @param {Set<string>} out */
function collectKeys(v, prefix = '', out = new Set()) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) {
      const pathKey = prefix ? `${prefix}.${k}` : k;
      out.add(pathKey);
      collectKeys(/** @type {Record<string, unknown>} */ (v)[k], pathKey, out);
    }
  }
  return out;
}

/** @type {Record<string, Set<string>>} */
const keySets = {};

for (const file of files) {
  const data = JSON.parse(
    fs.readFileSync(path.join(messagesDir, file), 'utf8'),
  );
  keySets[file] = collectKeys(data.BankingTab, '', new Set());
}

const canonicalName = files.includes('en.json') ? 'en.json' : files[0];
const canonical = keySets[canonicalName];
let failed = false;

for (const file of files) {
  if (file === canonicalName) continue;
  const keys = keySets[file];
  const missing = [...canonical].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !canonical.has(k));
  if (missing.length > 0 || extra.length > 0) {
    failed = true;
    console.error(`❌ BankingTab mismatch in ${file}`);
    if (missing.length > 0) {
      console.error(`  missing (${missing.length}):`);
      missing.slice(0, 20).forEach((k) => console.error(`    - ${k}`));
      if (missing.length > 20) {
        console.error(`    … and ${missing.length - 20} more`);
      }
    }
    if (extra.length > 0) {
      console.error(`  extra (${extra.length}):`);
      extra.slice(0, 20).forEach((k) => console.error(`    - ${k}`));
      if (extra.length > 20) {
        console.error(`    … and ${extra.length - 20} more`);
      }
    }
  }
}

if (failed) {
  console.error(
    '\nRun: pnpm --filter @hypha-platform/i18n run sync:banking-tab',
  );
  process.exit(1);
}

console.log(
  `✓ BankingTab keys match across ${files.length} locale files (${canonical.size} flattened keys, canonical: ${canonicalName}).`,
);
