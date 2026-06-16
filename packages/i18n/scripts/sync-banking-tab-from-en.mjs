#!/usr/bin/env node
/**
 * Deep-merge `BankingTab` from en.json into every locale file.
 * Existing locale strings are preserved; missing keys are filled from English.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'src', 'messages');

function deepMergeDefaults(defaults, existing) {
  if (
    defaults === null ||
    typeof defaults !== 'object' ||
    Array.isArray(defaults)
  ) {
    return existing !== undefined ? existing : defaults;
  }

  const base =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ? { ...existing }
      : {};

  for (const key of Object.keys(defaults)) {
    if (key in base) {
      base[key] = deepMergeDefaults(defaults[key], base[key]);
    } else {
      base[key] = defaults[key];
    }
  }

  return base;
}

const enPath = path.join(messagesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const canonical = en.BankingTab;

if (!canonical) {
  console.error('❌ en.json has no BankingTab namespace');
  process.exit(1);
}

for (const file of fs
  .readdirSync(messagesDir)
  .filter((name) => name.endsWith('.json'))) {
  const filePath = path.join(messagesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.BankingTab = deepMergeDefaults(canonical, data.BankingTab);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`✓ merged BankingTab → ${file}`);
}
