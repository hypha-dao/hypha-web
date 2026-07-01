#!/usr/bin/env node
/** One-off generator: writes translations/banking-tab/maps/{de,es,fr,pt}.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import de from './banking-tab-maps/de.mjs';
import es from './banking-tab-maps/es.mjs';
import fr from './banking-tab-maps/fr.mjs';
import pt from './banking-tab-maps/pt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, '..', 'translations', 'banking-tab', 'maps');
const tsvPath = path.join(__dirname, 'banking-tab-en-keys.tsv');

/** @type {Record<string, Record<string, string>>} */
const locales = { de, es, fr, pt };

function parseTsv() {
  let raw = fs.readFileSync(tsvPath, 'utf16le');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.trim().split('\n');
  /** @type {string[]} */
  const keys = [];
  for (const line of lines) {
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    keys.push(line.slice(0, tab));
  }
  return keys;
}

function writeMaps() {
  fs.mkdirSync(mapsDir, { recursive: true });
  for (const [locale, map] of Object.entries(locales)) {
    const out = path.join(mapsDir, `${locale}.json`);
    fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    console.log(`${locale}: ${Object.keys(map).length} keys → ${out}`);
  }
}

const expectedKeys = parseTsv();
for (const [locale, map] of Object.entries(locales)) {
  const missing = expectedKeys.filter((k) => !(k in map));
  const extra = Object.keys(map).filter((k) => !expectedKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`${locale}: missing=${missing.length} extra=${extra.length}`);
    if (missing.length) console.error('  missing:', missing.slice(0, 10).join(', '));
    if (extra.length) console.error('  extra:', extra.slice(0, 10).join(', '));
    process.exit(1);
  }
}

writeMaps();
