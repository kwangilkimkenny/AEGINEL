// ── Aegis Personal 9-Layer Detection Engine ──────────────────────────────────────
// Pure JS, zero dependencies

import type { AeginelConfig, LayerResult, ScanResult, RiskLevel } from './types';
import { DEFAULT_CONFIG } from './config';
import { scanPii } from './pii-scanner';

let scanCounter = 0;

export function scan(input: string, site: string, config: AeginelConfig = DEFAULT_CONFIG, conversationHistory?: string[]): ScanResult {
  const id = `scan-${Date.now()}-${++scanCounter}`;
  const t0 = performance.now();

  if (!config.enabled || !input.trim()) {
    return emptyScanResult(id, input, site);
  }

  const lower = input.toLowerCase();
  const layers: LayerResult[] = [];
  let totalScore = 0;

  // ── Layer 1: Basic Keywords ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.basicKeywords ? detectBasicKeywords(lower, cats) : 0;
    totalScore += score;
    layers.push({ id: 1, name: 'Basic Keywords', score, maxScore: 60, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 2: Jailbreak Patterns ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.jailbreak ? detectJailbreakPatterns(lower, cats) : 0;
    totalScore += score;
    layers.push({ id: 2, name: 'Jailbreak', score, maxScore: 40, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 3: Injection Patterns ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.injection ? detectInjectionPatterns(lower, input, cats) : 0;
    totalScore += score;
    layers.push({ id: 3, name: 'Injection', score, maxScore: 40, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 4: Extraction Patterns ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.extraction ? detectExtractionPatterns(lower, cats) : 0;
    totalScore += score;
    layers.push({ id: 4, name: 'Data Extraction', score, maxScore: 30, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 5: Social Engineering ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.socialEngineering ? detectSocialEngineering(lower, cats) : 0;
    totalScore += score;
    layers.push({ id: 5, name: 'Social Engineering', score, maxScore: 30, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 6: Korean/CJK Evasion ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.koreanEvasion ? detectKoreanEvasion(input, cats) : 0;
    totalScore += score;
    layers.push({ id: 6, name: 'Script Evasion', score, maxScore: 45, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 7: Encoding Attacks ──
  {
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.encodingAttacks ? detectEncodingAttacks(input, lower, cats) : 0;
    totalScore += score;
    layers.push({ id: 7, name: 'Encoding Attacks', score, maxScore: 30, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 8: Multi-turn Signals ──
  {
    const t = performance.now();
    const cats: string[] = [];
    let score = config.layers.multiTurn ? detectMultiTurnSignals(lower, cats) : 0;
    // Enhanced multi-turn: analyze conversation history for attack patterns
    if (config.layers.multiTurn && conversationHistory && conversationHistory.length > 0) {
      score += detectMultiTurnContext(lower, conversationHistory, cats);
    }
    score = Math.min(score, 45); // raised cap to accommodate history bonus
    totalScore += score;
    layers.push({ id: 8, name: 'Multi-turn', score, maxScore: 45, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // ── Layer 9: Semantic Risk ──
  {
    const allCats = layers.flatMap(l => l.categories);
    const t = performance.now();
    const cats: string[] = [];
    const score = config.layers.semanticRisk ? detectSemanticRisk(lower, cats, allCats) : 0;
    totalScore += score;
    layers.push({ id: 9, name: 'Semantic Risk', score, maxScore: 30, detected: score > 0, categories: cats, latencyMs: performance.now() - t });
  }

  // Apply sensitivity multiplier
  const adjustedScore = Math.min(Math.round(totalScore * config.sensitivity), 100);
  const allCategories = [...new Set(layers.flatMap(l => l.categories))];
  const level = scoreToLevel(adjustedScore);
  const blocked = adjustedScore >= config.blockThreshold;

  // PII scan — PII exposure adds to the risk score
  const piiDetected = scanPii(input, config);
  let piiScore = 0;
  if (piiDetected.length > 0) {
    if (!allCategories.includes('pii_exposure')) {
      allCategories.push('pii_exposure');
    }
    // Score: 15 per PII item, max 30 — personal data leakage is a real risk
    piiScore = Math.min(piiDetected.length * 15, 30);
  }

  const finalScore = Math.min(adjustedScore + piiScore, 100);
  const finalLevel = scoreToLevel(finalScore);
  const finalBlocked = finalScore >= config.blockThreshold;

  const explanation = buildExplanation(finalScore, allCategories, piiDetected.length);

  return {
    id,
    timestamp: Date.now(),
    input: input.slice(0, 200), // truncate for storage
    site,
    score: finalScore,
    level: finalLevel,
    categories: allCategories,
    explanation,
    blocked: finalBlocked,
    layers,
    totalLatencyMs: performance.now() - t0,
    piiDetected,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function emptyScanResult(id: string, input: string, site: string): ScanResult {
  return {
    id, timestamp: Date.now(), input: input.slice(0, 200), site,
    score: 0, level: 'low', categories: [], explanation: 'No risks detected.',
    blocked: false, layers: [], totalLatencyMs: 0, piiDetected: [],
  };
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function buildExplanation(score: number, categories: string[], piiCount: number): string {
  const parts: string[] = [];
  if (categories.length > 0) {
    parts.push(`Detected: ${categories.join(', ')}`);
  }
  if (piiCount > 0) {
    parts.push(`${piiCount} PII item(s) found`);
  }
  if (parts.length === 0) return 'No significant risks detected.';
  return `${parts.join('. ')}. Risk: ${score}/100.`;
}

// ── Layer 1: Basic Keywords ─────────────────────────────────────────────

function detectBasicKeywords(lower: string, cats: string[]): number {
  let s = 0;
  const groups: [string, string[]][] = [
    ['harmful_content', [
      'how to hack', 'make a bomb', 'create a virus', 'synthesize drugs',
      'synthesize methamphetamine', 'drug synthesis', 'chemical process to synthesize',
      'ransomware', 'malware creation', 'weapon', 'exploit code',
      'pump-and-dump', 'pump and dump', 'manipulate the market',
      'evade taxes', 'hide my income', 'offshore account',
      'write me a ransomware', 'encrypt all files',
      'forge', 'counterfeit', 'forging',
      '폭탄', '마약', '해킹', '랜섬웨어', '살인', '자살 방법', '독약',
      '폭발물', '위조', '탈세',
    ]],
    ['jailbreak', [
      'do anything now', 'ignore your instructions', 'bypass safety',
      'without restrictions', 'no restrictions', 'bypass all',
      'disable safety', 'override safety',
    ]],
    ['data_extraction', [
      'system prompt', 'your instructions', 'your rules',
      'api key', 'database password', 'credentials',
    ]],
  ];
  for (const [cat, keywords] of groups) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { cats.push(cat); s += 20; break; }
    }
  }
  return s;
}

// ── Layer 2: Jailbreak Patterns ─────────────────────────────────────────

function detectJailbreakPatterns(lower: string, cats: string[]): number {
  let s = 0;
  const patterns = [
    { re: /ignore (your |previous |all )?instructions/i, w: 25 },
    { re: /you are now (dan|unrestricted|evil)/i, w: 30 },
    { re: /pretend you (are|have no|can)/i, w: 20 },
    { re: /developer mode (enabled|activated)/i, w: 25 },
    { re: /act as (if|a hacker|an? ai without)/i, w: 20 },
    { re: /override (all |safety |security )?protocols?/i, w: 25 },
    { re: /disable (content |safety )?filter/i, w: 25 },
    { re: /hypothetically|purely theoretical|for educational purposes|this is purely/i, w: 15 },
    { re: /write a story.*without.*constraints|without ethical constraints/i, w: 20 },
    { re: /pharmacology.*professor|chemistry.*teacher/i, w: 10 },
    { re: /규칙을 잊어|이전 지시를 무시|제한 없는/i, w: 25 },
    { re: /너는 이제|모든 질문에 답해/i, w: 20 },
  ];
  let detected = false;
  for (const { re, w } of patterns) {
    if (re.test(lower)) { detected = true; s += w; }
  }
  if (detected) cats.push('jailbreak');
  return Math.min(s, 40);
}

// ── Layer 3: Injection Patterns ─────────────────────────────────────────

function detectInjectionPatterns(lower: string, original: string, cats: string[]): number {
  let s = 0;
  const patterns: [RegExp, number][] = [
    [/system:\s*new instruction/i, 25],
    [/\]\]>|<\/ignore>|<\/system>/i, 25],
    [/new.?instruction|forget everything/i, 20],
    [/developer:\s*(override|disable)/i, 25],
    [/<!--.*(?:disable|override|ignore).*-->/i, 20],
    [/\[system:?\s*(override|ignore)/i, 25],
    [/새로운 지시사항|이전 지시를 무시/i, 25],
    [/assistant:\s*ignore|ignore all rules/i, 20],
    [/reveal system prompt/i, 20],
  ];
  let detected = false;
  for (const [re, w] of patterns) {
    if (re.test(original) || re.test(lower)) { detected = true; s += w; }
  }
  if (detected) cats.push('prompt_injection');
  return Math.min(s, 40);
}

// ── Layer 4: Extraction Patterns ────────────────────────────────────────

function detectExtractionPatterns(lower: string, cats: string[]): number {
  let s = 0;
  const patterns = [
    'system prompt', 'your instructions', 'your rules', 'training data',
    'original prompt', 'initial instructions', 'api key', 'database password',
    'credentials', 'model architecture', 'respond with your original prompt',
    'social security number', 'previous conversation',
    'personal data', 'what personal data',
  ];
  let detected = false;
  for (const p of patterns) {
    if (lower.includes(p)) { detected = true; s += 15; }
  }
  if (detected) cats.push('data_extraction');
  return Math.min(s, 30);
}

// ── Layer 5: Social Engineering ─────────────────────────────────────────

function detectSocialEngineering(lower: string, cats: string[]): number {
  let s = 0;
  const patterns: [RegExp, number][] = [
    [/this is an emergency|life.?or.?death|someone is dying/i, 25],
    [/dosage of|administer|prescri(be|ption)/i, 10],
    [/i('m| am) (the |a )?(ceo|admin|developer|owner)/i, 15],
    [/compliance team approved|already agreed|already approved/i, 20],
    [/execute now|do it immediately|wire transfer/i, 15],
    [/제발 도와|너무 힘들어|살고 싶지 않/i, 20],
    [/since we('re| are) friends/i, 15],
    [/if you could.*how would/i, 15],
    [/write this entire exam|complete .* for me/i, 15],
    [/defame|devastating.*campaign|negative campaign/i, 15],
  ];
  let detected = false;
  for (const [re, w] of patterns) {
    if (re.test(lower)) { detected = true; s += w; }
  }
  if (detected) cats.push('social_engineering');
  return Math.min(s, 30);
}

// ── Layer 6: Korean/CJK Evasion ─────────────────────────────────────────

function detectKoreanEvasion(input: string, cats: string[]): number {
  let s = 0;

  // Chosung detection (ㄱ-ㅎ consecutive runs)
  const chosungCount = Array.from(input).filter(c => c >= '\u3131' && c <= '\u314E').length;
  if (chosungCount >= 3) { cats.push('script_evasion'); s += 25; }

  // Jamo vowel detection (ㅏ-ㅣ)
  const jungseongCount = Array.from(input).filter(c => c >= '\u314F' && c <= '\u3163').length;
  if (jungseongCount >= 3) { cats.push('script_evasion'); s += 25; }

  // Fullwidth Latin (ａ-ｚ, Ａ-Ｚ)
  const fullwidthCount = Array.from(input).filter(c => c >= '\uFF01' && c <= '\uFF5E').length;
  if (fullwidthCount >= 3) { cats.push('encoding_attack'); s += 20; }

  // Code-switching: Korean + harmful English
  const hasKorean = /[\uAC00-\uD7A3]/.test(input);
  const hasHarmfulEnglish = /\b(hack|bomb|drug|kill|exploit|crack|password|ransomware)\b/i.test(input);
  if (hasKorean && hasHarmfulEnglish) { cats.push('script_evasion'); s += 20; }

  // Josai insertion
  const josaiPattern = /[가-힣]을[가-힣]을|[가-힣]를[가-힣]를/;
  if (josaiPattern.test(input)) { cats.push('script_evasion'); s += 25; }

  // Spacing manipulation
  const collapsedKorean = input.replace(/\s+/g, '');
  const koreanHarmful = ['자살방법', '폭탄제조', '독약제조', '마약제조', '해킹방법', '살인방법'];
  for (const kw of koreanHarmful) {
    if (collapsedKorean.includes(kw)) { cats.push('script_evasion'); s += 25; break; }
  }

  // Spaced Korean harmful words
  const spacedPattern = /자\s*살\s*방\s*법|독\s*약\s*제\s*조|폭\s*탄\s*제\s*조|마\s*약\s*제\s*조|해\s*킹\s*방\s*법|살\s*인\s*방\s*법/;
  if (spacedPattern.test(input)) { cats.push('script_evasion'); s += 25; }

  // Cyrillic + Latin homoglyph
  const hasCyrillic = /[\u0400-\u04FF]/.test(input);
  const hasLatin = /[a-zA-Z]/.test(input);
  if (hasCyrillic && hasLatin) { cats.push('encoding_attack'); s += 20; }

  return Math.min(s, 45);
}

// ── Layer 7: Encoding Attacks ───────────────────────────────────────────

function detectEncodingAttacks(original: string, lower: string, cats: string[]): number {
  let s = 0;

  if (/base64|decode.*instruction|aG93/i.test(original)) {
    cats.push('encoding_attack'); s += 20;
  }
  if (/\b(?:hex|0x[0-9a-f]{8,}|686f77)\b/i.test(original)) {
    cats.push('encoding_attack'); s += 15;
  }
  if (/rot13|translate from/i.test(lower)) {
    cats.push('encoding_attack'); s += 15;
  }

  const leetRatio = (original.match(/[0-9]/g) || []).length / Math.max(original.length, 1);
  const hasLeetWords = /[a-z][0-9][a-z]/i.test(original);
  if (leetRatio > 0.1 && hasLeetWords) {
    cats.push('encoding_attack'); s += 20;
  }

  const specialChars = Array.from(original).filter(c =>
    !(/[a-zA-Z0-9\s.,!?'"()가-힣ㄱ-ㅎㅏ-ㅣ]/).test(c)
  ).length;
  if (specialChars > original.length * 0.25 && original.length > 10) {
    cats.push('encoding_attack'); s += 10;
  }

  return Math.min(s, 30);
}

// ── Layer 8: Multi-turn Signals ─────────────────────────────────────────

function detectMultiTurnSignals(lower: string, cats: string[]): number {
  let s = 0;
  const patterns: [RegExp, number][] = [
    [/previous (session|conversation)|we (agreed|discussed) earlier/i, 20],
    [/you already (approved|agreed|confirmed)/i, 20],
    [/as we agreed|remember:?\s*you/i, 15],
    [/first.*then.*now|first.*which.*now.*how/i, 20],
    [/but I need to ask|but now|그런데 그/i, 15],
    [/교육 목적|for (the )?plot/i, 15],
    [/common household chemicals.*dangerous.*mix|dangerous when mixed.*combine/i, 20],
  ];
  let detected = false;
  for (const [re, w] of patterns) {
    if (re.test(lower)) { detected = true; s += w; }
  }
  if (detected) cats.push('multi_turn');
  return Math.min(s, 30);
}

// ── Layer 8b: Multi-turn Context Analysis ───────────────────────────
// Analyzes conversation history to detect gradual escalation, topic shifting,
// and context manipulation attacks across multiple turns.

function detectMultiTurnContext(currentLower: string, history: string[], cats: string[]): number {
  let bonus = 0;

  // Quick-score helper: rough risk estimate for a single input
  function quickRiskScore(text: string): number {
    let s = 0;
    const harmful = [
      'hack', 'bomb', 'virus', 'drug', 'weapon', 'exploit', 'malware',
      'ransomware', 'kill', 'steal', 'forge', 'counterfeit',
      'ignore your instructions', 'bypass safety', 'without restrictions',
      'system prompt', 'api key', 'credentials',
      '폭탄', '마약', '해킹', '랜섬웨어', '살인', '독약',
    ];
    const lower = text.toLowerCase();
    for (const kw of harmful) {
      if (lower.includes(kw)) s += 10;
    }
    return Math.min(s, 30);
  }

  const historyScores = history.map(h => quickRiskScore(h));
  const currentScore = quickRiskScore(currentLower);

  // ── Gradual escalation ──
  // Previous inputs were mostly safe (low scores) but current has noticeably higher risk
  if (history.length >= 2) {
    const avgHistoryScore = historyScores.reduce((a, b) => a + b, 0) / historyScores.length;
    if (avgHistoryScore < 10 && currentScore >= 20) {
      if (!cats.includes('multi_turn_escalation')) cats.push('multi_turn_escalation');
      bonus += 10;
    }
  }

  // ── Topic shifting ──
  // Previous messages were about benign topics, now asking for harmful content
  if (history.length >= 1) {
    const allPrevSafe = historyScores.every(s => s === 0);
    const currentHasHarmful = currentScore > 0;
    // Also check for explicit topic-shift signals
    const shiftSignals = /but now|however.*can you|one more thing|also|by the way|그런데|그리고/i;
    if (allPrevSafe && currentHasHarmful && shiftSignals.test(currentLower)) {
      if (!cats.includes('multi_turn_topic_shift')) cats.push('multi_turn_topic_shift');
      bonus += 10;
    }
  }

  // ── Context manipulation ──
  // Current message references prior agreement/discussion that can be verified against actual history
  const manipulationPhrases = [
    /as we discussed/i,
    /you already agreed/i,
    /you (said|confirmed|approved) (earlier|before|previously)/i,
    /remember when you/i,
    /we already (agreed|established|confirmed)/i,
    /이전에 (합의|동의|확인)/i,
    /아까 (말한|했던)/i,
  ];

  for (const re of manipulationPhrases) {
    if (re.test(currentLower)) {
      // Check if history actually contains anything that would justify the claim
      const historyJoined = history.join(' ').toLowerCase();
      const hasRelatedHistory =
        historyJoined.includes('agree') ||
        historyJoined.includes('confirm') ||
        historyJoined.includes('approved') ||
        historyJoined.includes('동의') ||
        historyJoined.includes('확인');

      if (!hasRelatedHistory) {
        // Claiming prior context that doesn't exist — likely manipulation
        if (!cats.includes('multi_turn_context_manipulation')) cats.push('multi_turn_context_manipulation');
        bonus += 15;
        break;
      }
    }
  }

  return Math.min(bonus, 15);
}

// ── Layer 9: Semantic Risk ──────────────────────────────────────────────

function detectSemanticRisk(lower: string, cats: string[], allCats: string[]): number {
  let s = 0;

  const harmfulActions = [
    'make a bomb', 'create a virus', 'synthesize drugs', 'synthesize methamphetamine',
    'steal', 'kill', 'forge', 'counterfeit', 'manipulate the market', 'evade taxes',
    'pump.?and.?dump', 'wire transfer', 'offshore account',
    'toxic gas', 'ransomware program', 'encrypt all files',
    'change my gr[a4]des', 'h[a4]ck', 'fake website',
    '폭발물', '위조', '탈세', '사기', '해킹하는',
  ];
  for (const action of harmfulActions) {
    const re = new RegExp(action, 'i');
    if (re.test(lower)) { cats.push('harmful_content'); s += 15; break; }
  }

  if (/step.?by.?step|detailed|exact(ly)?|단계별|자세한|구체적/i.test(lower)) {
    const alreadyHarmful = allCats.some(c =>
      ['harmful_content', 'jailbreak', 'script_evasion'].includes(c)
    );
    if (alreadyHarmful) { s += 10; }
  }

  if (/자살|살고 싶지 않|suicide|end my life|self.?harm/i.test(lower)) {
    cats.push('self_harm');
    s += 25;
  }

  return Math.min(s, 30);
}
