#!/usr/bin/env node
/**
 * Ensures `.ModalAside` keys match across every locale JSON under `src/messages`.
 * CI / pre-commit helper for next-intl consistency (CodeRabbit parity checks).
 *
 * Uses `en.json` as the canonical key set when present; compares flattened
 * nested keys under `.ModalAside` (e.g. `buttons.close`).
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

if (files.length === 0) {
  console.error(`❌ no locale JSON files found in ${messagesDir}`);
  process.exit(1);
}

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
  const fullPath = path.join(messagesDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  if (!raw.trim()) {
    console.error(`❌ ${file}: empty file`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${file}: invalid JSON — ${message}`);
    process.exit(1);
  }
  const modalAside = parsed.ModalAside;
  if (!modalAside || typeof modalAside !== 'object') {
    console.error(`❌ ${file}: missing .ModalAside object`);
    process.exit(1);
  }
  keySets[file] = collectKeys(modalAside);
}

const canonical = files.includes('en.json') ? 'en.json' : files[0];
const reference = keySets[canonical];

let ok = true;
for (const file of files) {
  const ks = keySets[file];
  const missing = [...reference].filter((k) => !ks.has(k));
  const extra = [...ks].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    ok = false;
    console.error(`❌ ${file} vs ${canonical}`);
    if (missing.length) console.error(`   missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`   extra: ${extra.join(', ')}`);
  }
}

if (!ok) {
  process.exit(1);
}

console.log(
  `✓ ModalAside keys match across ${files.length} locale files (${reference.size} flattened keys, canonical: ${canonical}).`,
);
