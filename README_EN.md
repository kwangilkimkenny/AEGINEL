# AEGINEL Chrome Extension

**AI Prompt Security Guard for LLM Chat Interfaces**

> A Chrome extension that detects prompt risks in real-time across 28+ AI services and automatically pseudonymizes personally identifiable information (PII) to protect user privacy.

Developed by **YATAV Inc.** | [Personal: Free (AGPL-3.0)](#personal-use-agpl-30) · [Enterprise: Paid (Commercial)](#enterprise-use-commercial-license)

---

## Table of Contents

- [Overview](#overview)
- [Supported Sites](#supported-sites)
- [Core Features](#core-features)
  - [1. 9-Layer Threat Detection Engine](#1-9-layer-threat-detection-engine)
  - [2. PII Detection (7 Types)](#2-pii-detection-7-types)
  - [3. PII Proxy Pseudonymization Engine](#3-pii-proxy-pseudonymization-engine)
  - [4. Real-time Warning Banners & Block Modals](#4-real-time-warning-banners--block-modals)
  - [5. Response Restoration](#5-response-restoration)
  - [6. Popup Dashboard](#6-popup-dashboard)
  - [7. AI Guard Model (ML-based Classifier)](#7-ai-guard-model-ml-based-classifier)
- [Architecture](#architecture)
- [Installation & Build](#installation--build)
- [Configuration](#configuration)
- [Scoring System](#scoring-system)
- [Site Adapters](#site-adapters)
- [Tech Stack](#tech-stack)
- [File Structure](#file-structure)
- [Internationalization (i18n)](#internationalization-i18n)
- [Testing](#testing)

---

## Overview

AEGINEL Extension **analyzes text in real-time** as users type into LLM chat interfaces:

1. **Dangerous prompts** (jailbreaks, injections, harmful content, etc.) are detected across 9 independent security layers with warnings and blocking
2. **Personal information** (national IDs, credit cards, emails, phone numbers, etc. — 7 types) is automatically detected
3. **PII Proxy** replaces personal information with fake data before sending to the LLM, then restores originals in the response

All processing is **100% client-side** — no data is ever sent to external servers.

| Item | Details |
|------|---------|
| Version | 1.0.0 |
| Manifest | Chrome Extension MV3 |
| Build Size | ~256KB (core) + 133MB (Guard Model) |
| Rule Engine Latency | < 2ms (P50) |
| Guard Model Latency | ~7.6ms (CPU INT8) |
| Permissions | `storage`, `activeTab`, `offscreen` |
| Supported Sites | **28 AI Services** |
| Guard Model | DistilBERT multilingual (ONNX INT8, 129.5MB) |

---

## Supported Sites

### Hand-tuned Adapters

Precisely tuned CSS selectors with site-specific optimizations.

| Site | Domain | Editor Type |
|------|--------|-------------|
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` | ProseMirror (contenteditable) |
| **Claude** | `claude.ai` | ProseMirror (contenteditable) |
| **Gemini** | `gemini.google.com` | Quill Editor (contenteditable) |

### Generic Adapters (Registry-based)

Configuration-driven universal adapters. Add a new service instantly by adding a selector config to `registry.ts`.

| Category | Site | Domain |
|----------|------|--------|
| **Major AI Chatbots** | Microsoft Copilot | `copilot.microsoft.com`, `www.bing.com` |
| | Perplexity AI | `perplexity.ai` |
| | DeepSeek | `chat.deepseek.com` |
| | Grok (xAI) | `grok.com`, `x.com` |
| | Meta AI | `meta.ai` |
| | Mistral Le Chat | `chat.mistral.ai` |
| | Pi (Inflection) | `pi.ai` |
| **Multi-model Platforms** | Poe | `poe.com` |
| | HuggingChat | `huggingface.co/chat` |
| | Chatbot Arena (LMSYS) | `lmarena.ai`, `chat.lmsys.org` |
| | OpenRouter | `openrouter.ai` |
| **Developer AI** | Phind | `phind.com` |
| | GitHub Copilot | `github.com/copilot` |
| | Groq | `groq.com` |
| | Vercel AI | `sdk.vercel.ai` |
| **AI Platforms / Studios** | Google AI Studio | `aistudio.google.com` |
| | Anthropic Console | `console.anthropic.com` |
| | Together AI | `together.ai` |
| | Replicate | `replicate.com` |
| | Dify | `cloud.dify.ai` |
| **Content / Enterprise AI** | Character.AI | `character.ai` |
| | Jasper | `app.jasper.ai` |
| | WriteSonic | `app.writesonic.com` |
| | Notion AI | `notion.so` |
| | Cohere Coral | `coral.cohere.com` |
| **Local AI** | Open WebUI (Ollama) | `localhost`, `127.0.0.1` |

---

## Core Features

### 1. 9-Layer Threat Detection Engine

All user input is analyzed in real-time across 9 independent security layers.

#### Layer 1: Basic Keywords (max 60 pts)

Detects harmful content, jailbreak, and data extraction keywords in multiple languages.

| Category | Example Keywords | Language |
|----------|-----------------|----------|
| `harmful_content` | make a bomb, drug synthesis, ransomware, exploit code | EN |
| `harmful_content` | bomb, drugs, hacking, ransomware, murder, suicide method, poison, forgery, tax evasion | KO |
| `jailbreak` | do anything now, ignore your instructions, bypass safety | EN |
| `data_extraction` | system prompt, api key, database password, credentials | EN |

#### Layer 2: Jailbreak Patterns (max 40 pts)

Detects sophisticated jailbreak attempts using regex patterns.

| Pattern | Score |
|---------|-------|
| `ignore (your\|previous\|all)? instructions` | 25 |
| `you are now (DAN\|unrestricted\|evil)` | 30 |
| `developer mode (enabled\|activated)` | 25 |
| `override (all\|safety\|security)? protocols?` | 25 |
| `pretend you (are\|have no\|can)` | 20 |
| `hypothetically\|purely theoretical\|for educational purposes` | 15 |
| Korean jailbreak patterns | 20-25 |

#### Layer 3: Injection Patterns (max 40 pts)

Detects prompt injection markers and system command forgery.

| Pattern | Score |
|---------|-------|
| `system: new instruction` | 25 |
| `]]>`, `</ignore>`, `</system>` | 25 |
| `[system: override\|ignore]` | 25 |
| `developer: (override\|disable)` | 25 |
| HTML comment injection `<!-- disable -->` | 20 |
| Korean injection patterns | 25 |

#### Layer 4: Data Extraction (max 30 pts)

Detects attempts to extract system information, training data, and credentials.

- Keywords: `system prompt`, `training data`, `api key`, `credentials`, `model architecture`, `personal data`, etc.
- 15 points per match, max 30

#### Layer 5: Social Engineering (max 30 pts)

Detects emotional manipulation, authority impersonation, and urgency exploitation.

| Pattern | Score |
|---------|-------|
| `this is an emergency\|life or death` | 25 |
| `I'm the (CEO\|admin\|developer\|owner)` | 15 |
| `compliance team approved\|already agreed` | 20 |
| `execute now\|do it immediately\|wire transfer` | 15 |
| Korean social engineering patterns | 20 |

#### Layer 6: Korean/CJK Script Evasion (max 45 pts)

Detects evasion attacks using Korean and CJK characters.

| Detection Item | Description | Score |
|----------------|-------------|-------|
| **Chosung separation** | 3+ consecutive consonants (e.g., decomposed Hangul) | 25 |
| **Jungseong separation** | 3+ consecutive vowels | 25 |
| **Fullwidth characters** | 3+ fullwidth Latin characters | 20 |
| **Code-switching** | Korean + harmful English words (hack, bomb, drug, etc.) | 20 |
| **Particle insertion** | Repeated grammatical particle patterns | 25 |
| **Spacing manipulation** | Detecting harmful words after whitespace removal | 25 |
| **Cyrillic+Latin homoglyphs** | Mixed Cyrillic and Latin characters | 20 |

#### Layer 7: Encoding Attacks (max 30 pts)

Detects encoding-based evasion attacks.

| Detection Item | Score |
|----------------|-------|
| Base64 / hex encoded keywords | 15-20 |
| ROT13 translation instructions | 15 |
| Leet-speak (digit ratio >10% + letter-digit-letter pattern) | 20 |
| Special character ratio >25% | 10 |

#### Layer 8: Multi-turn Signals (max 30 pts)

Detects evasion attempts across multi-turn conversations.

| Pattern | Score |
|---------|-------|
| `previous session\|we agreed earlier` | 20 |
| `you already approved\|confirmed` | 20 |
| `first...then...now` (gradual escalation) | 20 |
| `for educational purposes\|for the plot` | 15 |
| `common household chemicals...dangerous...mix` | 20 |

#### Layer 9: Semantic Risk (max 30 pts)

Detects semantically harmful action requests and self-harm content.

| Detection Item | Score |
|----------------|-------|
| Harmful action keywords (14 EN + 5 KO) | 15 |
| `step by step\|detailed` + existing harmful category | +10 |
| Self-harm: `suicide\|end my life\|self harm` | 25 |

---

### 2. PII Detection (7 Types)

Detects 7 types of personally identifiable information in real-time.

| PII Type | Example Pattern | Masking |
|----------|----------------|---------|
| **Korean RRN** (with dash) | `880101-1234567` | `880101-1***567` |
| **Korean RRN** (continuous) | `8801011234567` | `880101-1***567` |
| **Credit Card** (with separators) | `4111-1111-1111-1111` | `4111-****-****-1111` |
| **Credit Card** (continuous) | `4111111111111111` | `4111-****-****-1111` |
| **Email** | `user@example.com` | `u***@example.com` |
| **Korean Phone** (with dash) | `010-1234-5678` | `010-****-5678` |
| **Korean Phone** (continuous) | `01012345678` | `010-****-5678` |
| **International Phone** | `+82-10-1234-5678` | `+82-****-5678` |
| **US SSN** | `123-45-6789` | `***-**-6789` |
| **Passport** | `M12345678` | `M1*****78` |

**Validation:**
- Korean RRN: Gender code 1-4, month 1-12, day 1-31
- Credit Card: **Luhn checksum** verification
- US SSN: Invalid numbers (`000`, `666`, `0000`, etc.) excluded
- Overlap prevention: Automatically removes overlapping pattern matches

**PII Score Impact:**
- 1 PII detected = **+15 pts**
- 2+ PII detected = **+30 pts** (max)
- `pii_exposure` category automatically added

---

### 3. PII Proxy Pseudonymization Engine

Replaces detected PII with **format-preserving fake data** before sending to the LLM.

#### How It Works

```
User Input                          Text Sent to LLM
─────────────────────────────────   ─────────────────────────────────
"My SSN is 880101-1234567"        → "My SSN is 950215-2789432"
"Email: user@company.com"         → "Email: user_a1b2@example.com"
"Card: 4111-1111-1111-1111"       → "Card: 4829-1456-7234-8901"
```

#### Fake Data Generation Rules

| PII Type | Generation Rule |
|----------|----------------|
| Korean RRN | Valid YYMMDD format + gender code (1-4) + random 6 digits |
| Credit Card | **Luhn-valid** number, original separator positions preserved |
| Email | `user_<4-digit-hex>@example.com` |
| Phone (KR) | Original format preserved (dash/no-dash), prefix (010) kept |
| International Phone | Country code preserved + random number |
| US SSN | `XXX-XX-XXXX` format random |
| Passport | Original length preserved, random alphanumeric |

#### Key Properties

| Property | Description |
|----------|-------------|
| **Format Preservation** | Fake data matches original format (length, separator positions, checksums) |
| **Session Isolation** | Independent mapping table per conversation, no cross-session restoration |
| **Consistency** | Same PII in same session maps to same pseudonym |
| **Two Modes** | **Auto** (silent replacement) / **Confirm** (confirmation modal before replacement) |

#### Confirm Mode UI

In Confirm mode, a modal showing the mapping table is displayed before sending:

```
┌───────────────────────────────────────────┐
│  🛡️ PII Protection Confirmation            │
│                                           │
│  The following PII was detected and will  │
│  be pseudonymized:                        │
│  ┌───────────────────────────────────────┐ │
│  │ RRN    880101-1234567 → 950215-2789432 │
│  │ Email  user@test.com  → user_a1b2@example.com │
│  └───────────────────────────────────────┘ │
│                                           │
│          [Send Original]  [Send Protected] │
└───────────────────────────────────────────┘
```

---

### 4. Real-time Warning Banners & Block Modals

All UI elements are isolated via **Shadow DOM** to avoid interfering with site styles.

#### Warning Banner (4 Levels)

Displayed above the input area when risks are detected.

| Risk Level | Score | Color | Icon |
|------------|-------|-------|------|
| Low | 0-19 | Green (`#22c55e`) | 🛡️ |
| Medium | 20-39 | Yellow (`#eab308`) | ⚠️ |
| High | 40-59 | Orange (`#f97316`) | ⚠️ |
| Critical | 60+ | Red (`#ef4444`) | 🚨 |

Banners display detected categories, PII count, analysis latency (ms), and score.

#### Block Modal

When the score exceeds the Block Threshold (default 60), submission is blocked and a modal appears:

```
┌───────────────────────────────────────┐
│  🚨 Submission Blocked (Score: 75/100) │
│                                       │
│  Detected: harmful_content, jailbreak  │
│  2 PII item(s) found. Risk: 75/100.   │
│                                       │
│  [harmful content] [jailbreak]         │
│                                       │
│             [Go Back]  [Send Anyway]   │
└───────────────────────────────────────┘
```

- **Go Back**: Close modal (cancel submission)
- **Send Anyway**: User override (acknowledge risk and send)

#### Protection Banner

After PII Proxy pseudonymization, a blue banner is displayed for 3 seconds:

```
🛡️ 2 PII items have been protected
   PII Proxy: Sent with pseudonymized data
```

---

### 5. Response Restoration

When the LLM responds using pseudonymized data, those pseudonyms are automatically restored to the originals in the displayed response.

```
LLM Response (pseudonymized)               User Sees (restored)
────────────────────────────────────       ────────────────────────────────────
"Confirmed as 950215-2789432"            → "Confirmed as 880101-1234567"
"Sent to user_a1b2@example.com"          → "Sent to user@company.com"
```

**How it works:**
1. `MutationObserver` detects LLM response DOM changes
2. Waits for streaming to complete (500ms debounce + `isStreaming()` check)
3. `TreeWalker` traverses text nodes
4. Session mapping table replaces pseudonyms with originals

---

### 6. Popup Dashboard

React-based dashboard displayed when clicking the extension icon.

#### StatusCard

| Item | Description |
|------|-------------|
| AEGINEL Guard Toggle | Enable/disable all features |
| Active Site | Shows current tab's LLM site name |
| Scans | Total scan count |
| Blocked | Blocked threat count (red) |
| Protected | Protected PII count (blue) |

#### RiskMeter

- **SVG gauge**: 270-degree arc graph
- **Color coding**: Green → Yellow → Orange → Red based on score
- **Score display**: `/100` centered
- **Categories**: Last scan's detected categories + latency

#### Recent Scans

- Last 10 scan history entries
- Each item: Score badge | Site name | Categories | Time
- Scrollable (max height 192px)

#### Settings Panel

| Setting | Range | Default |
|---------|-------|---------|
| PII Detection | on/off | on |
| PII Proxy Auto-pseudonymization | on/off | on |
| PII Proxy Mode | Auto / Confirm | Auto |
| Notification Banner | on/off | on |
| Block Threshold | 20-100 (step 5) | 60 |
| Sensitivity | 0.5x-2.0x (step 0.1) | 1.0x |
| 9 Detection Layer Toggles | on/off | all on |
| Language | Auto / 20 languages | Auto |
| Clear Scan History | button | - |

---

### 7. AI Guard Model (ML-based Classifier)

Beyond the rule-based 9-Layer engine, AEGINEL includes a **machine learning-based multilingual prompt security classifier**. This model runs via **fully local in-browser inference** through Transformers.js in the Chrome Offscreen Document API.

#### Model Overview

| Item | Details |
|------|---------|
| Base Model | `distilbert-base-multilingual-cased` |
| Parameters | 135M |
| Training Data | 188,109 samples, 8 languages |
| Threat Classes | 6 types (multi-label) |
| Quantization | ONNX INT8 Dynamic Quantization |
| Model Size | **129.5 MB** |
| Inference Speed | **~7.6 ms/sample** (CPU) |
| Binary Detection Accuracy | **100%** (safe vs. harmful) |
| Runtime | Transformers.js + ONNX Runtime Web (WASM SIMD) |

#### Threat Classification Types (6)

| Label | Description |
|-------|-------------|
| `jailbreak` | Attempts to bypass AI model safety guardrails |
| `prompt_injection` | System prompt injection attacks |
| `harmful_content` | Requests for harmful content generation |
| `script_evasion` | Script/code-based evasion techniques |
| `social_engineering` | Emotional manipulation, authority impersonation |
| `encoding_bypass` | Encoding-based filter bypass |

#### Supported Languages (8)

Korean, English, Chinese, Japanese, Arabic, Spanish, Russian, Malay

#### Model Selection Process

Three candidate models were compared and evaluated:

| Model | f1_micro | INT8 Size | Note |
|-------|----------|-----------|------|
| XLM-RoBERTa-base | 99.97% | 265.9 MB | Size exceeded |
| **DistilBERT multilingual** | **99.78%** | **129.5 MB** | **✅ Selected** |
| mDeBERTa-v3-base | 99.97% | 322.8 MB | Size exceeded |

> DistilBERT achieves **over 2× size reduction** with only a 0.19%p performance trade-off, making it the only model that meets the browser extension size constraint (< 150MB).

#### Inference Pipeline

```
User Input → Content Script → Service Worker → Offscreen Document
                                                      │
                                              Transformers.js
                                              ONNX Runtime Web
                                              (WASM SIMD + Threading)
                                                      │
                                              model_quantized.onnx
                                              (129.5 MB, INT8)
                                                      │
                                              sigmoid → multi-label classification
                                                      │
                                              Result → warning/block
```

> For detailed training process and experiment results, see [`docs/AEGINEL_Guard_Model_Research.md`](docs/AEGINEL_Guard_Model_Research.md).

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  SERVICE WORKER (Background)                             │
│                                                          │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  9-Layer Engine  │  │  PII Scanner │  │ PII Proxy  │  │
│  │  (detector.ts)   │  │  (7 types)   │  │ Engine     │  │
│  └────────┬────────┘  └──────┬───────┘  └─────┬──────┘  │
│           │                  │                 │          │
│  ┌────────┴──────────────────┴─────────────────┴──────┐  │
│  │              Message Handler                        │  │
│  │  SCAN_INPUT · PROXY_INPUT · RESTORE_RESPONSE       │  │
│  │  GET_CONFIG · UPDATE_CONFIG · GET_STATUS            │  │
│  │  GET_HISTORY · CLEAR_HISTORY · GET_PROXY_STATS     │  │
│  └────────┬───────────────────────────────────────────┘  │
│           │ chrome.runtime.onMessage                     │
└───────────┼──────────────────────────────────────────────┘
            │
     ┌──────┼──────────────────────────────────────┐
     │      │                                      │
┌────▼─────────────────────┐  ┌──────▼──────────────────┐
│  CONTENT SCRIPT           │  │  POPUP UI (React)       │
│                           │  │                         │
│  ├─ Site Detection        │  │  ├─ StatusCard          │
│  │  ├─ Hand-tuned (3)     │  │  ├─ RiskMeter (SVG)     │
│  │  └─ Generic (25+)     │  │  ├─ RecentScans         │
│  ├─ Input Watching        │  │  └─ SettingsPanel       │
│  │  (debounce 300ms)      │  │     (9 layers, PII,     │
│  ├─ Enter Key Intercept   │  │      proxy, threshold)  │
│  ├─ Button Click Intercept│  │                         │
│  ├─ Warning Banner        │  └─────────────────────────┘
│  │  (Shadow DOM)          │
│  ├─ Block Modal           │  ┌──────────────────────────┐
│  ├─ Proxy Confirm Modal   │  │  OFFSCREEN DOCUMENT      │
│  ├─ Protected Banner      │  │  (AI Guard Model)        │
│  └─ Response Restoration  │  │                          │
│     (MutationObserver +   │  │  ├─ Transformers.js      │
│      TreeWalker)          │  │  ├─ ONNX Runtime Web     │
└───────────────────────────┘  │  │  (WASM SIMD+Threading) │
                               │  └─ DistilBERT INT8 ONNX │
                               │     (129.5 MB, 8 langs)   │
                               └──────────────────────────┘
```

### Site Adapter Architecture

```
SiteAdapter (Interface)
    │
    ├─ ChatGPT Adapter (hand-tuned)   ── ProseMirror optimized
    ├─ Claude Adapter (hand-tuned)    ── ProseMirror optimized
    ├─ Gemini Adapter (hand-tuned)    ── Quill Editor optimized
    │
    └─ Generic Adapter Factory        ── registry.ts config-driven
        ├─ Copilot
        ├─ Perplexity
        ├─ DeepSeek
        ├─ Grok
        ├─ Meta AI
        ├─ ... (25 services)
        └─ Open WebUI (localhost)
```

To add a new AI service, simply add a config object to `registry.ts`:

```typescript
{
  id: 'new-service',
  name: 'New AI Service',
  hostnames: ['new-ai.com'],
  inputSelectors: ['textarea', 'div[contenteditable="true"]'],
  submitSelectors: ['button[type="submit"]'],
  responseSelectors: ['.markdown', '.prose'],
  warningAnchorSelectors: ['form', 'main'],
  streamingSelectors: ['[class*="loading"]'],
}
```

### Data Flow

```
User Input
    │
    ▼ onInput (debounce 300ms)
Content Script ──SCAN_INPUT──► Service Worker
    │                              │
    │                    9-Layer Scan + PII Detect
    │                              │
    ◄──────SCAN_RESULT────────────┘
    │
    ▼ score > 0 ?
Show Banner (Low/Medium/High/Critical)
    │
    ▼ User clicks Send or presses Enter
    │
    ├─ score ≥ threshold? → Block Modal
    │
    ├─ PII Proxy enabled? → Fast PII heuristic check
    │   │
    │   ▼ PII likely present
    │   Content Script ──PROXY_INPUT──► Service Worker
    │   │                                    │
    │   │                        pseudonymize() → generate pseudonyms
    │   │                                    │
    │   ◄──────ProxyResult──────────────────┘
    │   │
    │   ├─ Auto mode: Silent text replacement + protection banner
    │   └─ Confirm mode: Confirmation modal → user choice
    │
    ▼ Submission complete
    │
    ▼ LLM response received (MutationObserver)
    │
    ▼ Wait for streaming to complete (500ms)
    │
Content Script ──RESTORE_RESPONSE──► Service Worker
    │                                       │
    │                            restore() → pseudonym → original
    │                                       │
    ◄──────restoredText────────────────────┘
    │
    ▼ Update DOM text nodes (TreeWalker)
```

---

## Installation & Build

### Requirements

- Node.js 18+
- pnpm (recommended) or npm

### Development Mode

```bash
pnpm install
pnpm dev
```

### Production Build

```bash
pnpm build
```

Build output is generated in the `dist/` folder.

### Install in Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist` folder
5. Visit any supported AI site to test

### Type Check

```bash
pnpm typecheck
```

---

## Configuration

### Default Configuration (DEFAULT_CONFIG)

```typescript
{
  enabled: true,                   // Global enable

  layers: {                        // 9 detection layers
    basicKeywords: true,
    jailbreak: true,
    injection: true,
    extraction: true,
    socialEngineering: true,
    koreanEvasion: true,
    encodingAttacks: true,
    multiTurn: true,
    semanticRisk: true,
  },

  pii: {                           // PII detection
    enabled: true,
    types: {
      korean_rrn: true,            // Korean Resident Registration Number
      credit_card: true,           // Credit Card
      email: true,                 // Email
      phone_kr: true,              // Korean Phone Number
      phone_intl: true,            // International Phone Number
      ssn: true,                   // US SSN
      passport: true,              // Passport Number
    },
  },

  piiProxy: {                      // PII pseudonymization
    enabled: true,
    mode: 'auto',                  // 'auto' | 'confirm'
    showNotification: true,        // Protection completion banner
  },

  sensitivity: 1.0,                // Sensitivity multiplier (0.5-2.0)
  blockThreshold: 60,              // Block threshold (0-100)
  language: 'auto',                // 'auto' | SupportedLocale (20 languages)
}
```

### Chrome Storage

| Key | Content | Limit |
|-----|---------|-------|
| `aeginel_config` | Full configuration | - |
| `aeginel_scan_history` | Scan history | Max 50 entries |
| `aeginel_stats` | Statistics (totalScans, threatsBlocked) | - |

---

## Scoring System

### Score Calculation

```
Final Score = min(Layer Sum × sensitivity + PII Score, 100)
```

| Item | Calculation |
|------|-------------|
| Layer Score | Sum of all 9 layer scores (each layer has its own max cap) |
| Sensitivity | Sum × sensitivity (0.5x-2.0x) |
| PII Score | 1 PII = +15, 2+ PII = +30 (max) |
| Final Score | min(Adjusted Score + PII Score, 100) |

### Risk Levels

| Level | Score Range | Badge Color | Action |
|-------|------------|-------------|--------|
| Low | 0 - 19 | Green | Banner shown |
| Medium | 20 - 39 | Yellow | Banner shown |
| High | 40 - 59 | Orange | Banner shown |
| Critical | 60 - 100 | Red | **Submission blocked** (default threshold=60) |

### Badge Display

The extension icon displays the score and color in real-time.

---

## Site Adapters

AEGINEL uses two adapter approaches:

### 1. Hand-tuned Adapters

Precisely tuned adapters for each LLM site's DOM structure.

#### ChatGPT Adapter

| Item | Selectors |
|------|-----------|
| Input | `#prompt-textarea`, `div.ProseMirror[contenteditable]`, `textarea[data-id="root"]` |
| Submit | `[data-testid="send-button"]`, `button[aria-label="Send prompt"]`, `form button[type="submit"]` |
| Response | `.markdown.prose`, `[data-message-author-role="assistant"] .markdown` |
| Streaming | `.result-streaming`, `[data-testid="stop-button"]` |

#### Claude Adapter

| Item | Selectors |
|------|-----------|
| Input | `div.ProseMirror[contenteditable]`, `div[contenteditable].is-editor-empty`, `fieldset div[contenteditable]` |
| Submit | `button[aria-label="Send Message"]`, `button[aria-label="Send message"]`, `fieldset button:last-of-type` |
| Response | `div.font-claude-message`, `[data-testid="chat-message-content"]` |
| Streaming | `[data-is-streaming="true"]` |

#### Gemini Adapter

| Item | Selectors |
|------|-----------|
| Input | `.ql-editor[contenteditable]`, `div[contenteditable][aria-label*="prompt"]`, `rich-textarea div[contenteditable]` |
| Submit | `button[aria-label="Send message"]`, `button.send-button` |
| Response | `.model-response-text`, `message-content .markdown` |
| Streaming | `.streaming`, `[data-is-streaming]` |

### 2. Generic Adapters (Registry-based)

Universal adapters auto-generated from configs defined in `registry.ts`. Each site configures:

| Config Item | Description |
|-------------|-------------|
| `id` | Site identifier |
| `name` | Display name |
| `hostnames` | Array of hostnames to match |
| `pathPrefix` | Optional path prefix (e.g., `/chat`) |
| `inputSelectors` | Input element CSS selector array |
| `submitSelectors` | Submit button CSS selector array |
| `responseSelectors` | LLM response container CSS selector array |
| `warningAnchorSelectors` | Warning banner anchor CSS selector array |
| `streamingSelectors` | Streaming state detection CSS selector array |

### ProseMirror-compatible Text Insertion

For correctly inserting pseudonymized text in ProseMirror editors (ChatGPT, Claude):

1. `Selection API` to select all existing text
2. `document.execCommand('insertText')` to go through the framework's input pipeline
3. Fallback: `InputEvent` (`inputType: 'insertText'`) + `compositionend` event
4. Additional `input` and `change` events for React/Next.js state synchronization

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Chrome Extension Manifest V3 |
| **Language** | TypeScript 5.6 |
| **UI Framework** | React 18.3 |
| **Styling** | Tailwind CSS 3.4 + Shadow DOM scoped CSS |
| **Build** | Vite 5.4 + @crxjs/vite-plugin 2.0 |
| **ML Runtime** | Transformers.js 3.8 + ONNX Runtime Web (WASM SIMD) |
| **Guard Model** | DistilBERT multilingual (INT8 ONNX, 129.5MB, 8 languages) |
| **Testing** | Vitest 4.0 (28 tests) |
| **i18n** | 20 languages (en, es, pt, fr, de, ja, ko, zh, it, nl, ru, ar, tr, pl, vi, id, th, hi, sv, cs) |

---

## File Structure

```
├── manifest.json                       # Chrome MV3 manifest (28 site URL patterns)
├── package.json                        # Dependencies and scripts
├── vite.config.ts                      # Vite + CRXJS build config
├── tsconfig.json                       # TypeScript config
├── tailwind.config.js                  # Tailwind CSS config
├── postcss.config.js                   # PostCSS config
│
├── src/
│   ├── background/
│   │   └── service-worker.ts           # Background service worker (message handler, badge)
│   │
│   ├── content/
│   │   ├── index.ts                    # Content script (input watching, submit interception)
│   │   ├── overlay/
│   │   │   ├── warning-banner.ts       # Shadow DOM banners/modals (4 types)
│   │   │   └── styles.css              # Overlay-specific CSS
│   │   └── sites/
│   │       ├── base.ts                 # SiteAdapter interface + common utilities
│   │       ├── chatgpt.ts              # ChatGPT hand-tuned adapter
│   │       ├── claude.ts               # Claude hand-tuned adapter
│   │       ├── gemini.ts               # Gemini hand-tuned adapter
│   │       ├── generic.ts              # Generic adapter factory
│   │       └── registry.ts             # 25 site config registry
│   │
│   ├── engine/
│   │   ├── types.ts                    # Core type definitions (ScanResult, AeginelConfig, etc.)
│   │   ├── config.ts                   # Config merge utility
│   │   ├── detector.ts                 # 9-Layer detection engine
│   │   ├── detector.test.ts            # Detection engine tests
│   │   ├── pii-scanner.ts             # PII pattern matching (7 types, 11 patterns)
│   │   ├── pii-scanner.test.ts        # PII scanner tests
│   │   ├── pii-proxy.ts              # PII pseudonymization engine (generation/restoration/sessions)
│   │   └── pii-proxy.test.ts         # PII Proxy tests (28 cases)
│   │
│   ├── offscreen/
│   │   ├── offscreen.html              # Offscreen Document HTML
│   │   └── offscreen.ts               # AI Guard Model inference (Transformers.js + ONNX)
│   │
│   ├── popup/
│   │   ├── index.html                  # Popup HTML entry
│   │   ├── main.tsx                    # React entry point
│   │   ├── App.tsx                     # Main app component
│   │   ├── styles.css                  # Tailwind base styles
│   │   ├── components/
│   │   │   ├── StatusCard.tsx          # Status card (toggle, stats)
│   │   │   ├── RiskMeter.tsx           # SVG gauge (risk level)
│   │   │   ├── RecentScans.tsx         # Recent scan history
│   │   │   └── SettingsPanel.tsx       # Settings panel (layers, PII, threshold)
│   │   └── hooks/
│   │       ├── useStorage.ts           # Chrome Storage hook
│   │       └── useMessages.ts          # Message sending hook
│   │
│   ├── shared/
│   │   ├── constants.ts               # Constants (sites, storage keys, limits)
│   │   ├── messages.ts                 # Message type definitions (13 types)
│   │   └── storage.ts                  # Chrome Storage wrapper
│   │
│   └── i18n/
│       ├── index.ts                    # i18n engine (t(), setLocale(), detectLocale())
│       ├── en.json                     # English (78 keys)
│       ├── ko.json                     # Korean (78 keys)
│       └── ... (18 additional language files)
│
├── public/
│   ├── icons/                          # Extension icons (16/32/48/128px)
│   ├── models/
│   │   └── guard/                      # AI Guard Model files
│   │       ├── model_quantized.onnx    # INT8 quantized ONNX model (129.5MB)
│   │       ├── tokenizer.json          # DistilBERT WordPiece vocab (2.8MB)
│   │       ├── config.json             # Model architecture + label map
│   │       └── labels.json             # AEGINEL label index (7 classes)
│   └── _locales/                       # Chrome i18n (en, ko)
│
├── data/
│   └── training/                       # Guard Model training pipeline
│       ├── train_guard.py              # Multi-label classifier training script
│       ├── export_onnx.py              # ONNX conversion + INT8 quantization script
│       └── aegis_guard_training_multilingual.jsonl  # Training data (188K samples)
│
├── docs/
│   └── AEGINEL_Guard_Model_Research.md # Guard Model research report
│
└── dist/                               # Build output
```

---

## Internationalization (i18n)

A lightweight i18n engine built without external libraries, supporting **20 languages**.

### Supported Languages

| # | Code | Language | # | Code | Language |
|---|------|----------|---|------|----------|
| 1 | `en` | English | 11 | `ru` | Russian |
| 2 | `es` | Spanish | 12 | `ar` | Arabic |
| 3 | `pt` | Portuguese | 13 | `tr` | Turkish |
| 4 | `fr` | French | 14 | `pl` | Polish |
| 5 | `de` | German | 15 | `vi` | Vietnamese |
| 6 | `ja` | Japanese | 16 | `id` | Indonesian |
| 7 | `ko` | Korean | 17 | `th` | Thai |
| 8 | `zh` | Chinese | 18 | `hi` | Hindi |
| 9 | `it` | Italian | 19 | `sv` | Swedish |
| 10 | `nl` | Dutch | 20 | `cs` | Czech |

### i18n Engine (`src/i18n/index.ts`)

| API | Description |
|-----|-------------|
| `t(key, params?)` | Returns translated string by dot-path key. `t('settings.title')` |
| `t(key, { count })` | `{{param}}` interpolation support. `t('proxy.protected', { count: 3 })` |
| `setLocale(locale)` | Set active language. `'auto'` triggers browser language detection |
| `detectLocale()` | Auto-detect based on `navigator.language` |
| `getLocale()` | Returns current active language code |
| `LANGUAGE_OPTIONS` | `{ code, label }[]` array for dropdowns |

### Translation Coverage

Each language file contains **78 keys** covering:

| Scope | Key Examples | Description |
|-------|-------------|-------------|
| `guard` | `AEGINEL Guard` | App title |
| `status.*` | `protected`, `disabled`, `noSite` | Status display |
| `stats.*` | `scans`, `blocked`, `piiProtected` | Statistics labels |
| `risk.*` | `low`, `medium`, `high`, `critical` | Risk levels |
| `history.*` | `title`, `empty`, `clean` | Scan history |
| `settings.*` | `title`, `pii`, `threshold`, `layers` | Settings panel |
| `settings.layerNames.*` | 9 detection layer names | Layer toggles |
| `banner.*` | `detected`, `blocked`, `goBack`, `sendAnyway` | Warning/block UI |
| `categories.*` | 10 threat categories | Category names |
| `proxy.*` | `protected`, `confirmTitle`, `confirm`, `skip` | PII Proxy UI |

### Language Auto-detection

When `language: 'auto'` is set:
1. Extract language code from `navigator.language` (e.g., `ko-KR` → `ko`)
2. Match against supported language list
3. Fallback to English (`en`) if no match
4. Regional variants like `zh-*`, `pt-*` are mapped to base codes

### Fallback Chain

```
Current Language → English (en) → Key string itself
```

Missing translations automatically fall back to English, and if English is also missing, the key string is returned as-is.

---

## Testing

```bash
# Run all tests
npx vitest run

# Watch mode
npx vitest

# Coverage
npx vitest run --coverage
```

### Test Coverage (28 cases)

| Test Group | Count | Content |
|------------|-------|---------|
| pseudonymize | 6 | Each of 7 PII types + no-PII case |
| multiple PII | 2 | 2-3 concurrent PII items |
| restore | 4 | Pseudonym restoration, multiple restoration, missing mapping, missing pseudonym |
| session isolation | 2 | Cross-session restoration prevention, session deletion |
| consistency | 1 | Same PII reuses same pseudonym |
| format preservation | 5 | RRN format, phone dash, SSN format, email format, passport length |
| config respect | 2 | PII disabled, specific type disabled |
| getTotalProtected | 2 | Total protection count tracking, decrease on session deletion |
| edge cases | 4 | Empty string, PII-only text, non-PII text preservation, empty text restoration |

---

## License

AEGINEL is an AI security technology developed by **YATAV Inc.** and is released as open source under a **dual license** model.

| User | License | Cost | Conditions |
|------|---------|------|------------|
| **Personal / Non-commercial** | AGPL-3.0 | Free | Source disclosure required on modification |
| **Enterprise / Commercial** | Commercial License | Paid | Separate agreement required |

### Personal Use (AGPL-3.0)

Use by individual developers, students, researchers, and non-profit organizations for **non-commercial purposes** is provided **free of charge** under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).

- All features (9-Layer detection engine, PII Proxy, 20 language support, etc.) available without restrictions
- Source code freely viewable, modifiable, and redistributable
- If you distribute modified code or provide it as a network service, you must **open source under the same AGPL-3.0 license**
- Includes personal projects, open source projects, educational and research purposes

### Enterprise Use (Commercial License)

Companies, commercial services, or those who do not want the AGPL-3.0 source disclosure obligation must purchase a **commercial license**.

- AGPL-3.0 source disclosure obligation waived
- Integration into proprietary products and services for commercial distribution
- Priority technical support and SLA guarantee
- Custom site adapter development support
- Dedicated onboarding and consulting
- Enterprise dashboard and admin console

**Commercial license inquiries:** contact@yatav.com

### FAQ

| Question | Answer |
|----------|--------|
| Can individuals use it for free? | Yes. All features are available for free under AGPL-3.0 terms. |
| Is it free for startups? | If used commercially or you need closed-source distribution, a commercial license is required. |
| What if I just install it personally without modifications? | You can use it freely without source disclosure obligations. |
| What if we modify and distribute internally to employees? | This constitutes commercial activity and requires a commercial license. |
| Can I include it in an open source project? | Yes, if the project uses an AGPL-3.0 compatible license. |
| How do I add a new AI service? | Add a config object to `registry.ts` and URL patterns to `manifest.json`. |

---

Copyright (c) 2024-2026 YATAV Inc. All rights reserved.

This software is licensed under the AGPL-3.0 for non-commercial use. Commercial use requires a separate license. See above for details.
