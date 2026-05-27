#!/usr/bin/env node
/**
 * Apply flat-path translation maps to `BankingTab` in locale message files.
 * Maps live in `translations/banking-tab/maps/{locale}.json` (dot paths → string).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'src', 'messages');
const mapsDir = path.join(__dirname, '..', 'translations', 'banking-tab', 'maps');

/** @param {Record<string, unknown>} tree @param {string} prefix @param {Record<string, string>} map */
function applyFlatMap(tree, prefix, map) {
  if (typeof tree === 'string') {
    return map[prefix] ?? tree;
  }
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) {
    return tree;
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(tree)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    out[key] = applyFlatMap(
      /** @type {Record<string, unknown>} */ (tree)[key],
      pathKey,
      map,
    );
  }
  return out;
}

const mapFiles = fs
  .readdirSync(mapsDir)
  .filter((name) => name.endsWith('.json'));

for (const file of mapFiles) {
  const locale = file.replace(/\.json$/, '');
  const targetPath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(targetPath)) {
    console.warn(`⚠ skip ${locale}: no ${targetPath}`);
    continue;
  }

  const map = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf8'));
  const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  if (!data.BankingTab) {
    console.warn(`⚠ skip ${locale}: no BankingTab in messages`);
    continue;
  }

  data.BankingTab = applyFlatMap(data.BankingTab, '', map);
  fs.writeFileSync(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(
    `✓ applied ${Object.keys(map).length} BankingTab strings → ${locale}.json`,
  );
}
