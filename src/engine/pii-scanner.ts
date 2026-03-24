// ── PII Scanner (NER Model-Based) ──────────────────────────────────────────────
// Detects PII entities using a mBERT PII-NER ONNX model running in an
// offscreen document, then maps NER labels to PiiType/PiiMatch.

import type { PiiMatch, PiiType, AeginelConfig } from './types';
import { runNerInference, type NerEntity } from './pii-ner-client';

const NER_LABEL_TO_PII_TYPE: Record<string, PiiType> = {
  GIVENNAME: 'givenname',
  SURNAME: 'surname',
  USERNAME: 'username',
  EMAIL: 'email',
  TELEPHONENUM: 'phone_kr',
  DATEOFBIRTH: 'dateofbirth',
  CREDITCARDNUMBER: 'credit_card',
  IDCARD: 'idcard',
  STREET: 'street',
  CITY: 'city',
  ZIPCODE: 'zipcode',
  BUILDINGNUM: 'buildingnum',
  IP_ADDRESS: 'ip_address',
  PASSWORD: 'password',
  ACCOUNTNUM: 'accountnum',
  DRIVERLICENSENUM: 'driverlicensenum',
  COMPANY: 'company',
  TIME: 'time',
};

function nerLabelToPiiType(nerLabel: string): PiiType | null {
  const cleaned = nerLabel.replace(/^[BI]-/, '');
  return NER_LABEL_TO_PII_TYPE[cleaned] ?? null;
}

function maskValue(value: string, piiType: PiiType): string {
  if (value.length <= 3) return '***';

  switch (piiType) {
    case 'email': {
      const atIdx = value.indexOf('@');
      if (atIdx > 1) return value[0] + '***' + value.slice(atIdx);
      return value[0] + '***';
    }
    case 'credit_card':
    case 'accountnum':
      return value.slice(0, 4) + '****' + value.slice(-4);
    case 'phone_kr':
    case 'phone_intl':
      return value.slice(0, 3) + '****' + value.slice(-4);
    case 'idcard':
    case 'korean_rrn':
    case 'ssn':
    case 'driverlicensenum':
    case 'passport':
      return value.slice(0, 3) + '***' + value.slice(-3);
    case 'ip_address':
      return value.replace(/\d+$/, '***');
    case 'password':
      return '********';
    case 'time':
      return '**:**';
    default:
      return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
  }
}

/**
 * Compute character offsets for NER entities by aligning token words
 * against the original text. The HuggingFace JS transformers pipeline
 * for token-classification may omit `start`/`end` character offsets,
 * returning only `entity`, `score`, and `word` (with wordpiece `##` prefixes).
 */
function computeCharOffsets(entities: NerEntity[], text: string): NerEntity[] {
  let cursor = 0;
  const lowerText = text.toLowerCase();

  return entities.map((e) => {
    if (e.start >= 0 && e.end >= 0) return e;

    const word = e.word.replace(/^##/, '');
    const lowerWord = word.toLowerCase();

    // Allow small gaps (whitespace / special chars the tokenizer may skip)
    let idx = lowerText.indexOf(lowerWord, cursor);
    if (idx === -1 && cursor > 0) {
      // Retry from a slightly earlier position to handle tokenizer quirks
      idx = lowerText.indexOf(lowerWord, Math.max(0, cursor - 2));
    }

    if (idx !== -1) {
      cursor = idx + word.length;
      return { ...e, start: idx, end: idx + word.length };
    }

    // Fallback: place right after previous token
    const start = cursor;
    const end = cursor + word.length;
    cursor = end;
    return { ...e, start, end };
  });
}

export async function scanPii(input: string, config: AeginelConfig): Promise<PiiMatch[]> {
  if (!config.pii?.enabled || !input.trim()) return [];

  let entities: Awaited<ReturnType<typeof runNerInference>>;
  try {
    entities = await runNerInference(input);
  } catch (err) {
    console.error('[PII Scanner] NER inference failed, returning empty:', err);
    return [];
  }
  if (entities.length === 0) return [];

  const enabledTypes = config.pii.types;
  const matches: PiiMatch[] = [];

  const withOffsets = computeCharOffsets(entities, input);
  const merged = mergeEntities(withOffsets, input);

  for (const entity of merged) {
    const piiType = nerLabelToPiiType(entity.entity);
    if (!piiType) continue;
    if (enabledTypes[piiType] === false) continue;

    const rawValue = input.slice(entity.start, entity.end);
    if (!rawValue.trim()) continue;

    matches.push({
      type: piiType,
      value: maskValue(rawValue, piiType),
      startIndex: entity.start,
      endIndex: entity.end,
    });
  }

  return matches;
}

/**
 * Merge adjacent NER entities of the same type into single spans.
 * The model may split a single PII value across multiple tokens
 * (e.g. B-EMAIL + I-EMAIL + I-EMAIL for "john@example.com").
 */
function mergeEntities(entities: NerEntity[], _text: string): NerEntity[] {
  if (entities.length === 0) return [];

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const merged: NerEntity[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentBase = current.entity.replace(/^[BI]-/, '');
    const nextBase = next.entity.replace(/^[BI]-/, '');

    if (currentBase === nextBase && next.start <= current.end + 1) {
      current.end = Math.max(current.end, next.end);
      current.score = Math.max(current.score, next.score);
      current.word += next.word;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}
