#!/usr/bin/env npx tsx
/**
 * i18n key verification script.
 * Compares en.json (source of truth) against ko.json and es.json.
 * Also scans source files for t('key') calls and checks they exist in en.json.
 *
 * Usage: npx tsx scripts/verify-i18n.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const I18N_DIR = join(ROOT, 'src', 'i18n');
const SRC_DIR = join(ROOT, 'src');

type NestedObj = { [key: string]: string | NestedObj };

// ── Helpers ────────────────────────────────────────────────────────────

function flattenKeys(obj: NestedObj, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...flattenKeys(v as NestedObj, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadJson(filename: string): NestedObj {
  const raw = readFileSync(join(I18N_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

function walkDir(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      results.push(...walkDir(full, ext));
    } else if (ext.some(e => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

function extractTKeys(content: string): string[] {
  const keys: string[] = [];
  const re = /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

// ── Main ───────────────────────────────────────────────────────────────

let exitCode = 0;
const errors: string[] = [];
const warnings: string[] = [];

const en = loadJson('en.json');
const enKeys = new Set(flattenKeys(en));

const UI_LOCALES: [string, string][] = [
  ['ko', 'ko.json'],
  ['es', 'es.json'],
];

// 1. Check each UI locale has all keys from en.json
for (const [locale, file] of UI_LOCALES) {
  let localeObj: NestedObj;
  try {
    localeObj = loadJson(file);
  } catch {
    errors.push(`[${locale}] Cannot read ${file}`);
    continue;
  }
  const localeKeys = new Set(flattenKeys(localeObj));

  const missing = [...enKeys].filter(k => !localeKeys.has(k));
  const extra = [...localeKeys].filter(k => !enKeys.has(k));

  if (missing.length > 0) {
    exitCode = 1;
    errors.push(`[${locale}] Missing ${missing.length} key(s):\n  ${missing.join('\n  ')}`);
  }
  if (extra.length > 0) {
    warnings.push(`[${locale}] Extra ${extra.length} key(s) (not in en.json):\n  ${extra.join('\n  ')}`);
  }
}

// 2. Check interpolation params match between en and locale files
for (const [locale, file] of UI_LOCALES) {
  let localeObj: NestedObj;
  try {
    localeObj = loadJson(file);
  } catch {
    continue;
  }
  const localeFlat = new Map<string, string>();
  function flatten(obj: NestedObj, prefix = '') {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        flatten(v as NestedObj, path);
      } else {
        localeFlat.set(path, v as string);
      }
    }
  }
  flatten(localeObj);

  const enFlat = new Map<string, string>();
  function flattenEn(obj: NestedObj, prefix = '') {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        flattenEn(v as NestedObj, path);
      } else {
        enFlat.set(path, v as string);
      }
    }
  }
  flattenEn(en);

  const paramRe = /\{\{(\w+)\}\}/g;
  for (const [key, enVal] of enFlat) {
    const localeVal = localeFlat.get(key);
    if (!localeVal) continue;
    const enParams = new Set([...enVal.matchAll(paramRe)].map(m => m[1]));
    const localeParams = new Set([...localeVal.matchAll(paramRe)].map(m => m[1]));
    const missingParams = [...enParams].filter(p => !localeParams.has(p));
    if (missingParams.length > 0) {
      exitCode = 1;
      errors.push(`[${locale}] Key "${key}" missing interpolation params: {{${missingParams.join('}}, {{')}}}}`);
    }
  }
}

// 3. Scan source files for t('key') calls and verify keys exist
const srcFiles = walkDir(SRC_DIR, ['.ts', '.tsx']);
const usedKeys = new Set<string>();
const missingInSource: { key: string; file: string }[] = [];

for (const file of srcFiles) {
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
  if (file.includes('/i18n/')) continue;

  const content = readFileSync(file, 'utf-8');
  const keys = extractTKeys(content);
  for (const key of keys) {
    usedKeys.add(key);
    if (!enKeys.has(key)) {
      missingInSource.push({ key, file: file.replace(ROOT + '/', '') });
    }
  }
}

if (missingInSource.length > 0) {
  exitCode = 1;
  const grouped = new Map<string, string[]>();
  for (const { key, file } of missingInSource) {
    const files = grouped.get(key) ?? [];
    files.push(file);
    grouped.set(key, files);
  }
  const lines = [...grouped].map(([key, files]) => `  "${key}" used in ${files.join(', ')}`);
  errors.push(`t() keys not found in en.json (${grouped.size} key(s)):\n${lines.join('\n')}`);
}

// 4. Check for unused keys (warning only)
const unusedKeys = [...enKeys].filter(k => !usedKeys.has(k));
if (unusedKeys.length > 0) {
  warnings.push(`Potentially unused keys in en.json (${unusedKeys.length}):\n  ${unusedKeys.join('\n  ')}`);
}

// ── Output ─────────────────────────────────────────────────────────────

console.log('\n=== i18n Verification ===\n');
console.log(`en.json keys: ${enKeys.size}`);
console.log(`t() keys found in source: ${usedKeys.size}`);
console.log(`UI locales checked: ${UI_LOCALES.map(([l]) => l).join(', ')}\n`);

if (warnings.length > 0) {
  console.log('⚠ WARNINGS:');
  for (const w of warnings) console.log(`  ${w}\n`);
}

if (errors.length > 0) {
  console.log('✗ ERRORS:');
  for (const e of errors) console.log(`  ${e}\n`);
  console.log(`\nResult: FAIL (${errors.length} error(s))\n`);
} else {
  console.log('✓ All checks passed!\n');
}

process.exit(exitCode);
