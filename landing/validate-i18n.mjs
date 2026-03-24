#!/usr/bin/env node
/**
 * Landing page i18n key validation script.
 *
 * Checks:
 * 1. All keys used in HTML (data-i18n, data-i18n-html) exist in every JSON file
 * 2. All JSON files have identical key sets
 * 3. No JSON keys are unused in HTML
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LANGS = ['ko', 'en', 'es'];
let hasError = false;

function err(msg) {
  console.error(`  ❌ ${msg}`);
  hasError = true;
}
function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

// 1. Load all JSON files
const langData = {};
for (const lang of LANGS) {
  const path = join(__dirname, 'i18n', `${lang}.json`);
  try {
    langData[lang] = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    err(`Cannot read i18n/${lang}.json: ${e.message}`);
  }
}

if (hasError) {
  console.log('\n❌ Validation failed — missing JSON files.\n');
  process.exit(1);
}

// 2. Extract keys from HTML
const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
const htmlKeys = new Set();

const textMatches = html.matchAll(/data-i18n="([^"]+)"/g);
for (const m of textMatches) htmlKeys.add(m[1]);

const htmlMatches = html.matchAll(/data-i18n-html="([^"]+)"/g);
for (const m of htmlMatches) htmlKeys.add(m[1]);

console.log(`\n🔍 Validating landing page i18n (${LANGS.join(', ')})`);
console.log(`   HTML uses ${htmlKeys.size} keys\n`);

// 3. Check each lang has all HTML keys
for (const lang of LANGS) {
  const keys = new Set(Object.keys(langData[lang]));
  console.log(`── ${lang.toUpperCase()} (${keys.size} keys) ──`);

  let langOk = true;
  for (const k of htmlKeys) {
    if (!keys.has(k)) {
      err(`Missing key "${k}" in ${lang}.json`);
      langOk = false;
    }
  }

  if (langOk) ok(`All ${htmlKeys.size} HTML keys present`);
}

// 4. Cross-check: all JSONs should have the same keys
console.log(`\n── Cross-language consistency ──`);
const baseKeys = Object.keys(langData[LANGS[0]]).sort();
let consistent = true;

for (let i = 1; i < LANGS.length; i++) {
  const lang = LANGS[i];
  const keys = Object.keys(langData[lang]).sort();

  const missingInLang = baseKeys.filter(k => !keys.includes(k));
  const extraInLang = keys.filter(k => !baseKeys.includes(k));

  if (missingInLang.length > 0) {
    err(`${lang}.json is missing keys from ${LANGS[0]}.json: ${missingInLang.join(', ')}`);
    consistent = false;
  }
  if (extraInLang.length > 0) {
    err(`${lang}.json has extra keys not in ${LANGS[0]}.json: ${extraInLang.join(', ')}`);
    consistent = false;
  }
}

if (consistent) ok('All language files have identical key sets');

// 5. Check for unused keys (in JSON but not in HTML)
console.log(`\n── Unused key check ──`);
const allJsonKeys = new Set(Object.keys(langData[LANGS[0]]));
const unusedKeys = [...allJsonKeys].filter(k => !htmlKeys.has(k));

if (unusedKeys.length > 0) {
  for (const k of unusedKeys) {
    console.log(`  ⚠️  Unused key: "${k}" (in JSON but not in HTML)`);
  }
} else {
  ok('No unused keys');
}

// 6. Check for empty values
console.log(`\n── Empty value check ──`);
let emptyFound = false;
for (const lang of LANGS) {
  for (const [k, v] of Object.entries(langData[lang])) {
    if (typeof v === 'string' && v.trim() === '') {
      err(`Empty value for "${k}" in ${lang}.json`);
      emptyFound = true;
    }
  }
}
if (!emptyFound) ok('No empty values');

// Result
console.log('');
if (hasError) {
  console.log('❌ Validation FAILED — fix the issues above.\n');
  process.exit(1);
} else {
  console.log('✅ All validations passed!\n');
  process.exit(0);
}
