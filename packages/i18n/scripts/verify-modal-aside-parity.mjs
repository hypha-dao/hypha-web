#!/usr/bin/env node
/**
 * Ensures `.ModalAside` keys match across every locale JSON under `src/messages`.
 * CI / pre-commit helper for next-intl consistency (CodeRabbit parity checks).
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

/** @type {Record<string, Set<string>>} */
const keySets = {};

for (const file of files) {
  const raw = fs.readFileSync(path.join(messagesDir, file), 'utf8');
  const parsed = JSON.parse(raw);
  const modalAside = parsed.ModalAside;
  if (!modalAside || typeof modalAside !== 'object') {
    console.error(`❌ ${file}: missing .ModalAside object`);
    process.exit(1);
  }
  keySets[file] = new Set(Object.keys(modalAside));
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
  `✓ ModalAside keys match across ${files.length} locale files (${reference.size} keys).`,
);
