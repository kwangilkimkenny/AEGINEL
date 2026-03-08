# AEGINEL Chrome Extension

**AI Prompt Security Guard for LLM Chat Interfaces**

> 28개 이상의 AI 서비스에서 실시간으로 프롬프트 위험을 탐지하고, 개인정보(PII)를 자동 가명화하여 보호하는 Chrome 확장 프로그램

Developed by **주식회사 야타브 (YATAV Inc.)** | [개인: 무료 (AGPL-3.0)](#개인-사용-agpl-30) · [기업: 유료 (Commercial)](#기업-사용-commercial-license)

---

## 목차

- [개요](#개요)
- [지원 사이트](#지원-사이트)
- [핵심 기능](#핵심-기능)
  - [1. 9-Layer 위협 탐지 엔진](#1-9-layer-위협-탐지-엔진)
  - [2. PII 탐지 (7종)](#2-pii-탐지-7종)
  - [3. PII Proxy 가명화 엔진](#3-pii-proxy-가명화-엔진)
  - [4. 실시간 경고 배너 & 차단 모달](#4-실시간-경고-배너--차단-모달)
  - [5. 응답 복원 (Response Restoration)](#5-응답-복원-response-restoration)
  - [6. 팝업 대시보드](#6-팝업-대시보드)
  - [7. AI Guard Model (ML 기반 분류기)](#7-ai-guard-model-ml-기반-분류기)
- [아키텍처](#아키텍처)
- [설치 및 빌드](#설치-및-빌드)
- [설정 옵션](#설정-옵션)
- [점수 체계](#점수-체계)
- [사이트 어댑터](#사이트-어댑터)
- [기술 스택](#기술-스택)
- [파일 구조](#파일-구조)
- [다국어 지원 (i18n)](#다국어-지원-i18n)
- [테스트](#테스트)

---

## 개요

AEGINEL Extension은 사용자가 LLM 채팅 인터페이스에 입력하는 텍스트를 **실시간으로 분석**하여:

1. **위험한 프롬프트** (탈옥, 인젝션, 유해 콘텐츠 등)를 9개 레이어로 탐지하고 경고/차단
2. **개인정보** (주민번호, 카드번호, 이메일, 전화번호 등 7종)를 자동 감지
3. **PII Proxy**로 개인정보를 가짜 데이터로 대체하여 전송하고, LLM 응답에서 원본으로 복원

모든 처리는 **100% 클라이언트 사이드**에서 이루어지며, 외부 서버로 데이터를 전송하지 않습니다.

| 항목 | 상세 |
|------|------|
| 버전 | 1.0.0 |
| Manifest | Chrome Extension MV3 |
| 빌드 크기 | ~256KB (코어) + 133MB (Guard Model) |
| 룰 엔진 레이턴시 | < 2ms (P50) |
| Guard Model 레이턴시 | ~7.6ms (CPU INT8) |
| 권한 | `storage`, `activeTab`, `offscreen` |
| 지원 사이트 | **28개 AI 서비스** |
| Guard Model | DistilBERT multilingual (ONNX INT8, 129.5MB) |

---

## 지원 사이트

### 전용 어댑터 (Hand-tuned)

정밀하게 튜닝된 CSS 셀렉터와 사이트별 최적화가 적용된 어댑터입니다.

| 사이트 | 도메인 | 에디터 타입 |
|--------|--------|-------------|
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` | ProseMirror (contenteditable) |
| **Claude** | `claude.ai` | ProseMirror (contenteditable) |
| **Gemini** | `gemini.google.com` | Quill Editor (contenteditable) |

### Generic 어댑터 (Registry-based)

설정 기반 범용 어댑터로 자동 지원되는 서비스입니다. `registry.ts`에 셀렉터 설정만 추가하면 새로운 서비스를 즉시 지원할 수 있습니다.

| 카테고리 | 사이트 | 도메인 |
|----------|--------|--------|
| **대형 AI 챗봇** | Microsoft Copilot | `copilot.microsoft.com`, `www.bing.com` |
| | Perplexity AI | `perplexity.ai` |
| | DeepSeek | `chat.deepseek.com` |
| | Grok (xAI) | `grok.com`, `x.com` |
| | Meta AI | `meta.ai` |
| | Mistral Le Chat | `chat.mistral.ai` |
| | Pi (Inflection) | `pi.ai` |
| **멀티모델 플랫폼** | Poe | `poe.com` |
| | HuggingChat | `huggingface.co/chat` |
| | Chatbot Arena (LMSYS) | `lmarena.ai`, `chat.lmsys.org` |
| | OpenRouter | `openrouter.ai` |
| **개발자 AI** | Phind | `phind.com` |
| | GitHub Copilot | `github.com/copilot` |
| | Groq | `groq.com` |
| | Vercel AI | `sdk.vercel.ai` |
| **AI 플랫폼/스튜디오** | Google AI Studio | `aistudio.google.com` |
| | Anthropic Console | `console.anthropic.com` |
| | Together AI | `together.ai` |
| | Replicate | `replicate.com` |
| | Dify | `cloud.dify.ai` |
| **콘텐츠/엔터프라이즈 AI** | Character.AI | `character.ai` |
| | Jasper | `app.jasper.ai` |
| | WriteSonic | `app.writesonic.com` |
| | Notion AI | `notion.so` |
| | Cohere Coral | `coral.cohere.com` |
| **로컬 AI** | Open WebUI (Ollama) | `localhost`, `127.0.0.1` |

---

## 핵심 기능

### 1. 9-Layer 위협 탐지 엔진

사용자가 입력하는 모든 텍스트를 9개의 독립적인 보안 레이어로 실시간 분석합니다.

#### Layer 1: Basic Keywords (최대 60점)

유해 콘텐츠, 탈옥, 데이터 추출 관련 키워드를 다국어로 탐지합니다.

| 카테고리 | 키워드 예시 | 언어 |
|----------|------------|------|
| `harmful_content` | make a bomb, drug synthesis, ransomware, exploit code | EN |
| `harmful_content` | 폭탄, 마약, 해킹, 랜섬웨어, 살인, 자살 방법, 독약, 위조, 탈세 | KO |
| `jailbreak` | do anything now, ignore your instructions, bypass safety | EN |
| `data_extraction` | system prompt, api key, database password, credentials | EN |

#### Layer 2: Jailbreak Patterns (최대 40점)

정교한 탈옥 시도를 정규식 패턴으로 탐지합니다.

| 패턴 | 점수 |
|------|------|
| `ignore (your\|previous\|all)? instructions` | 25 |
| `you are now (DAN\|unrestricted\|evil)` | 30 |
| `developer mode (enabled\|activated)` | 25 |
| `override (all\|safety\|security)? protocols?` | 25 |
| `pretend you (are\|have no\|can)` | 20 |
| `hypothetically\|purely theoretical\|for educational purposes` | 15 |
| `규칙을 잊어\|이전 지시를 무시\|제한 없는` (KO) | 25 |
| `너는 이제\|모든 질문에 답해` (KO) | 20 |

#### Layer 3: Injection Patterns (최대 40점)

프롬프트 인젝션 마커 및 시스템 명령 위조를 탐지합니다.

| 패턴 | 점수 |
|------|------|
| `system: new instruction` | 25 |
| `]]>`, `</ignore>`, `</system>` | 25 |
| `[system: override\|ignore]` | 25 |
| `developer: (override\|disable)` | 25 |
| HTML 코멘트 인젝션 `<!-- disable -->` | 20 |
| `새로운 지시사항\|이전 지시를 무시` (KO) | 25 |

#### Layer 4: Data Extraction (최대 30점)

시스템 정보, 학습 데이터, 인증 정보 추출 시도를 탐지합니다.

- 키워드: `system prompt`, `training data`, `api key`, `credentials`, `model architecture`, `personal data` 등
- 매칭당 15점, 최대 30점

#### Layer 5: Social Engineering (최대 30점)

감정 조작, 권위 사칭, 긴급성 악용 패턴을 탐지합니다.

| 패턴 | 점수 |
|------|------|
| `this is an emergency\|life or death` | 25 |
| `I'm the (CEO\|admin\|developer\|owner)` | 15 |
| `compliance team approved\|already agreed` | 20 |
| `execute now\|do it immediately\|wire transfer` | 15 |
| `제발 도와\|너무 힘들어\|살고 싶지 않` (KO) | 20 |

#### Layer 6: Korean/CJK Script Evasion (최대 45점)

한국어 및 CJK 문자를 이용한 우회 공격을 탐지합니다.

| 탐지 항목 | 설명 | 점수 |
|-----------|------|------|
| **초성 분리** | ㄱ-ㅎ 연속 3개 이상 (예: `ㅎㅐㅋㅣㅇ`) | 25 |
| **중성 분리** | ㅏ-ㅣ 연속 3개 이상 | 25 |
| **전각 문자** | ａ-ｚ, Ａ-Ｚ 3개 이상 | 20 |
| **코드 스위칭** | 한국어 + 영어 유해 단어 (hack, bomb, drug 등) | 20 |
| **조사 삽입** | `를를`, `을을` 반복 패턴 | 25 |
| **띄어쓰기 조작** | `자 살 방 법` → `자살방법` (공백 제거 후 탐지) | 25 |
| **키릴+라틴 호모글리프** | 키릴 문자와 라틴 문자 혼합 | 20 |

#### Layer 7: Encoding Attacks (최대 30점)

인코딩을 이용한 우회 공격을 탐지합니다.

| 탐지 항목 | 점수 |
|-----------|------|
| Base64 / hex 인코딩 키워드 | 15-20 |
| ROT13 변환 지시 | 15 |
| Leet-speak (숫자 비율 >10% + 문자-숫자-문자 패턴) | 20 |
| 특수문자 비율 >25% | 10 |

#### Layer 8: Multi-turn Signals (최대 30점)

다중 턴 대화에서의 우회 시도를 탐지합니다.

| 패턴 | 점수 |
|------|------|
| `previous session\|we agreed earlier` | 20 |
| `you already approved\|confirmed` | 20 |
| `first...then...now` (점진적 에스컬레이션) | 20 |
| `교육 목적\|for the plot` | 15 |
| `common household chemicals...dangerous...mix` | 20 |

#### Layer 9: Semantic Risk (최대 30점)

의미론적으로 유해한 행동 요청 및 자해 관련 내용을 탐지합니다.

| 탐지 항목 | 점수 |
|-----------|------|
| 유해 행동 키워드 (14종 EN + 5종 KO) | 15 |
| `step by step\|detailed\|단계별` + 기존 유해 카테고리 | +10 |
| 자해 관련: `자살\|suicide\|end my life\|self harm` | 25 |

---

### 2. PII 탐지 (7종)

입력 텍스트에서 7종류의 개인정보를 실시간으로 탐지합니다.

| PII 유형 | 패턴 예시 | 마스킹 |
|----------|----------|--------|
| **주민등록번호** (대시 포함) | `880101-1234567` | `880101-1***567` |
| **주민등록번호** (연속) | `8801011234567` | `880101-1***567` |
| **신용카드** (구분자 포함) | `4111-1111-1111-1111` | `4111-****-****-1111` |
| **신용카드** (연속) | `4111111111111111` | `4111-****-****-1111` |
| **이메일** | `user@example.com` | `u***@example.com` |
| **한국 전화번호** (대시 포함) | `010-1234-5678` | `010-****-5678` |
| **한국 전화번호** (연속) | `01012345678` | `010-****-5678` |
| **국제 전화번호** | `+82-10-1234-5678` | `+82-****-5678` |
| **US SSN** | `123-45-6789` | `***-**-6789` |
| **여권번호** | `M12345678` | `M1*****78` |

**유효성 검증:**
- 주민번호: 성별 코드 1~4, 월 1~12, 일 1~31
- 신용카드: **Luhn 체크섬** 검증
- US SSN: `000`, `666`, `0000` 등 무효 번호 제외
- 중복 매칭 방지: 영역이 겹치는 패턴 자동 제거

**PII 점수 반영:**
- PII 1개 탐지 = **+15점**
- PII 2개 이상 = **+30점** (최대)
- `pii_exposure` 카테고리 자동 추가

---

### 3. PII Proxy 가명화 엔진

탐지된 개인정보를 **형식 보존 가짜 데이터**로 대체하여 LLM에 전송합니다.

#### 동작 방식

```
사용자 입력                      LLM에 전송되는 텍스트
─────────────────────────────    ─────────────────────────────
"내 주민번호는 880101-1234567"  →  "내 주민번호는 950215-2789432"
"이메일: user@company.com"     →  "이메일: user_a1b2@example.com"
"카드번호 4111-1111-1111-1111" →  "카드번호 4829-1456-7234-8901"
```

#### 가짜 데이터 생성 규칙

| PII 유형 | 생성 규칙 |
|----------|----------|
| 주민등록번호 | 유효한 YYMMDD 형식 + 성별코드(1-4) + 랜덤 6자리 |
| 신용카드 | **Luhn-valid** 번호 생성, 원본 구분자 위치 보존 |
| 이메일 | `user_<4자리hex>@example.com` |
| 전화번호(KR) | 원본 형식 보존 (대시 유/무), 프리픽스(010) 유지 |
| 국제전화 | 국가코드 보존 + 랜덤 번호 |
| US SSN | `XXX-XX-XXXX` 형식 랜덤 |
| 여권번호 | 원본 길이 보존, 영문자 + 숫자 랜덤 |

#### 핵심 특성

| 특성 | 설명 |
|------|------|
| **형식 보존** | 가짜 데이터가 원본과 동일한 형식 (길이, 구분자 위치, 체크섬) |
| **세션 격리** | 대화별 독립 매핑 테이블, 교차 세션 복원 불가 |
| **일관성** | 같은 세션에서 같은 PII → 같은 가명 (반복 언급 시 일관된 대체) |
| **2가지 모드** | **Auto** (자동 대체) / **Confirm** (확인 모달 후 대체) |

#### Confirm 모드 UI

Confirm 모드에서는 전송 전 매핑 테이블을 보여주는 모달이 표시됩니다:

```
┌───────────────────────────────────────┐
│  🛡️ 개인정보 보호 확인                 │
│                                       │
│  다음 개인정보가 감지되어 가명 처리됩니다: │
│  ┌───────────────────────────────────┐ │
│  │ 주민번호  880101-1234567 → 950215-2789432 │
│  │ 이메일    user@test.com  → user_a1b2@example.com │
│  └───────────────────────────────────┘ │
│                                       │
│          [원본 전송]  [보호 후 전송]     │
└───────────────────────────────────────┘
```

---

### 4. 실시간 경고 배너 & 차단 모달

모든 UI는 **Shadow DOM**으로 격리되어 사이트 스타일에 영향을 주지 않습니다.

#### 경고 배너 (4단계)

입력 텍스트에 위험이 감지되면 입력 영역 위에 배너가 표시됩니다.

| 위험도 | 점수 | 색상 | 아이콘 |
|--------|------|------|--------|
| Low | 0-19 | 녹색 (`#22c55e`) | 🛡️ |
| Medium | 20-39 | 노란색 (`#eab308`) | ⚠️ |
| High | 40-59 | 주황색 (`#f97316`) | ⚠️ |
| Critical | 60+ | 빨간색 (`#ef4444`) | 🚨 |

배너에는 카테고리, PII 개수, 분석 레이턴시(ms), 점수가 표시됩니다.

#### 차단 모달

점수가 Block Threshold(기본 60) 이상이면 전송이 차단되고 모달이 표시됩니다:

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

- **Go Back**: 모달 닫기 (전송 취소)
- **Send Anyway**: 사용자 오버라이드 (위험 감수 후 전송)

#### 보호 완료 배너

PII Proxy로 가명화 적용 후 파란색 배너가 3초간 표시됩니다:

```
🛡️ 2개의 개인정보가 보호되었습니다
   PII Proxy: 가명 처리 후 전송됨
```

---

### 5. 응답 복원 (Response Restoration)

LLM이 가명 데이터를 사용하여 응답하면, 해당 응답에서 가명을 원본으로 자동 복원합니다.

```
LLM 응답 (가명)                          사용자에게 보이는 응답 (원본 복원)
────────────────────────────────────     ────────────────────────────────────
"950215-2789432로 확인됩니다"          →  "880101-1234567로 확인됩니다"
"user_a1b2@example.com으로 발송"      →  "user@company.com으로 발송"
```

**동작 원리:**
1. `MutationObserver`로 LLM 응답 DOM 변화 감지
2. 스트리밍 완료 대기 (500ms 디바운스 + `isStreaming()` 체크)
3. `TreeWalker`로 텍스트 노드 순회
4. 세션 매핑 테이블 기반 가명 → 원본 치환

---

### 6. 팝업 대시보드


확장 프로그램 아이콘 클릭 시 표시되는 React 기반 대시보드입니다.

#### StatusCard

| 항목 | 설명 |
|------|------|
| AEGINEL Guard 토글 | 전체 기능 활성/비활성 |
| 활성 사이트 | 현재 탭의 LLM 사이트명 표시 |
| Scans | 총 스캔 횟수 |
| Blocked | 차단된 위협 수 (빨간색) |
| Protected | 보호된 PII 수 (파란색) |

#### RiskMeter

- **SVG 게이지**: 270도 호(arc) 그래프
- **색상 코딩**: 점수에 따라 녹색 → 노란색 → 주황색 → 빨간색
- **점수 표시**: `/100` 중앙 표시
- **카테고리**: 마지막 스캔의 탐지 카테고리 + 레이턴시

#### Recent Scans

- 최근 10건의 스캔 이력
- 각 항목: 점수 뱃지 | 사이트명 | 카테고리 | 시간
- 스크롤 가능 (최대 높이 192px)

#### Settings Panel

| 설정 | 범위 | 기본값 |
|------|------|--------|
| PII Detection | on/off | on |
| PII Proxy 자동 가명화 | on/off | on |
| PII Proxy 모드 | Auto / Confirm | Auto |
| 알림 배너 | on/off | on |
| Block Threshold | 20-100 (5단위) | 60 |
| Sensitivity | 0.5x-2.0x (0.1단위) | 1.0x |
| 9개 탐지 레이어 개별 토글 | on/off | 모두 on |
| Language | Auto / 20개 언어 선택 | Auto |
| Clear Scan History | 버튼 | - |

---

### 7. AI Guard Model (ML 기반 분류기)

AEGINEL은 룰 기반 9-Layer 엔진 외에, **머신러닝 기반 다국어 프롬프트 보안 분류기**를 탑재하고 있습니다. 이 모델은 Chrome Offscreen Document API에서 Transformers.js를 통해 **브라우저 내 완전 로컬 추론**으로 실행됩니다.

#### 모델 개요

| 항목 | 상세 |
|------|------|
| 기반 모델 | `distilbert-base-multilingual-cased` |
| 파라미터 수 | 135M |
| 학습 데이터 | 188,109개 샘플, 8개 언어 |
| 위협 분류 | 6개 유형 (다중 레이블) |
| 양자화 | ONNX INT8 Dynamic Quantization |
| 모델 크기 | **129.5 MB** |
| 추론 속도 | **~7.6 ms/sample** (CPU) |
| 이진 탐지 정확도 | **100%** (safe vs. harmful) |
| 런타임 | Transformers.js + ONNX Runtime Web (WASM SIMD) |

#### 위협 분류 유형 (6종)

| 레이블 | 설명 |
|--------|------|
| `jailbreak` | AI 모델 안전 장치 우회 시도 |
| `prompt_injection` | 시스템 프롬프트 인젝션 |
| `harmful_content` | 유해 콘텐츠 생성 요청 |
| `script_evasion` | 스크립트/코드 기반 우회 |
| `social_engineering` | 감정 조작, 권위 사칭 |
| `encoding_bypass` | 인코딩 기반 필터 우회 |

#### 지원 언어 (8개)

한국어, 영어, 중국어, 일본어, 아랍어, 스페인어, 러시아어, 말레이어

#### 모델 선정 과정

3개 후보 모델을 비교 실험하여 최종 선정하였습니다:

| 모델 | f1_micro | INT8 크기 | 비고 |
|------|----------|-----------|------|
| XLM-RoBERTa-base | 99.97% | 265.9 MB | 크기 초과 |
| **DistilBERT multilingual** | **99.78%** | **129.5 MB** | **✅ 채택** |
| mDeBERTa-v3-base | 99.97% | 322.8 MB | 크기 초과 |

> DistilBERT는 0.19%p의 미소한 성능 차이를 감수하고 **2배 이상 경량화**를 달성하여, 브라우저 확장의 크기 제약(< 150MB)을 충족하는 유일한 모델입니다.

#### 추론 파이프라인

```
사용자 입력 → Content Script → Service Worker → Offscreen Document
                                                      │
                                              Transformers.js
                                              ONNX Runtime Web
                                              (WASM SIMD + Threading)
                                                      │
                                              model_quantized.onnx
                                              (129.5 MB, INT8)
                                                      │
                                              sigmoid → 다중 레이블 분류
                                                      │
                                              결과 반환 → 경고/차단
```

> 자세한 학습 과정 및 실험 결과는 [`docs/AEGINEL_Guard_Model_Research.md`](docs/AEGINEL_Guard_Model_Research.md)를 참조하세요.

---

## 아키텍처

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

### 사이트 어댑터 아키텍처

```
SiteAdapter (인터페이스)
    │
    ├─ ChatGPT Adapter (전용)     ── ProseMirror 최적화
    ├─ Claude Adapter (전용)      ── ProseMirror 최적화
    ├─ Gemini Adapter (전용)      ── Quill Editor 최적화
    │
    └─ Generic Adapter Factory    ── registry.ts 설정 기반
        ├─ Copilot
        ├─ Perplexity
        ├─ DeepSeek
        ├─ Grok
        ├─ Meta AI
        ├─ ... (25개 서비스)
        └─ Open WebUI (localhost)
```

새로운 AI 서비스를 추가하려면 `registry.ts`에 설정 객체 하나만 추가하면 됩니다:

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

### 데이터 흐름

```
사용자 입력
    │
    ▼ onInput (debounce 300ms)
Content Script ──SCAN_INPUT──► Service Worker
    │                              │
    │                    9-Layer Scan + PII Detect
    │                              │
    ◄──────SCAN_RESULT────────────┘
    │
    ▼ score > 0 ?
배너 표시 (Low/Medium/High/Critical)
    │
    ▼ 사용자 Send 클릭 또는 Enter
    │
    ├─ score ≥ threshold? → 차단 모달
    │
    ├─ PII Proxy 활성? → 빠른 PII 휴리스틱 체크
    │   │
    │   ▼ PII 가능성 있음
    │   Content Script ──PROXY_INPUT──► Service Worker
    │   │                                    │
    │   │                        pseudonymize() → 가명 생성
    │   │                                    │
    │   ◄──────ProxyResult──────────────────┘
    │   │
    │   ├─ Auto 모드: 자동 텍스트 교체 + 보호 배너
    │   └─ Confirm 모드: 확인 모달 → 사용자 선택
    │
    ▼ 전송 완료
    │
    ▼ LLM 응답 수신 (MutationObserver)
    │
    ▼ 스트리밍 완료 대기 (500ms)
    │
Content Script ──RESTORE_RESPONSE──► Service Worker
    │                                       │
    │                            restore() → 가명 → 원본
    │                                       │
    ◄──────restoredText────────────────────┘
    │
    ▼ DOM 텍스트 노드 업데이트 (TreeWalker)
```

---

## 설치 및 빌드

### 요구 사항

- Node.js 18+
- pnpm (권장) 또는 npm

### 개발 모드

```bash
pnpm install
pnpm dev
```

### 프로덕션 빌드

```bash
pnpm build
```

`dist/` 폴더에 빌드 결과물이 생성됩니다.

### Chrome에 설치

1. `chrome://extensions` 접속
2. **개발자 모드** 활성화 (우측 상단 토글)
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `dist` 폴더 선택
5. 지원되는 AI 사이트에 접속하여 테스트

### 타입 체크

```bash
pnpm typecheck
```

---

## 설정 옵션

### 기본 설정 (DEFAULT_CONFIG)

```typescript
{
  enabled: true,                   // 전체 활성화

  layers: {                        // 9개 탐지 레이어
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

  pii: {                           // PII 탐지
    enabled: true,
    types: {
      korean_rrn: true,            // 주민등록번호
      credit_card: true,           // 신용카드
      email: true,                 // 이메일
      phone_kr: true,              // 한국 전화번호
      phone_intl: true,            // 국제 전화번호
      ssn: true,                   // US SSN
      passport: true,              // 여권번호
    },
  },

  piiProxy: {                      // PII 가명화
    enabled: true,
    mode: 'auto',                  // 'auto' | 'confirm'
    showNotification: true,        // 보호 완료 배너
  },

  sensitivity: 1.0,                // 감도 배수 (0.5-2.0)
  blockThreshold: 60,              // 차단 임계값 (0-100)
  language: 'auto',                // 'auto' | SupportedLocale (20개 언어)
}
```

### Chrome Storage

| 키 | 내용 | 제한 |
|----|------|------|
| `aeginel_config` | 전체 설정 | - |
| `aeginel_scan_history` | 스캔 이력 | 최대 50건 |
| `aeginel_stats` | 통계 (totalScans, threatsBlocked) | - |

---

## 점수 체계

### 점수 산출

```
최종 점수 = min(레이어 합산 × sensitivity + PII 점수, 100)
```

| 항목 | 계산 |
|------|------|
| 레이어 점수 | 9개 레이어의 각 점수 합산 (각 레이어별 max cap 적용) |
| Sensitivity | 합산 점수 × sensitivity (0.5x~2.0x) |
| PII 점수 | PII 1개 = +15, 2개+ = +30 (최대) |
| 최종 점수 | min(조정 점수 + PII 점수, 100) |

### 위험도 등급

| 등급 | 점수 범위 | 배지 색상 | 동작 |
|------|----------|----------|------|
| Low | 0 - 19 | 녹색 | 배너 표시 |
| Medium | 20 - 39 | 노란색 | 배너 표시 |
| High | 40 - 59 | 주황색 | 배너 표시 |
| Critical | 60 - 100 | 빨간색 | **전송 차단** (기본 threshold=60) |

### 배지 표시

확장 프로그램 아이콘에 점수와 색상이 실시간으로 표시됩니다.

---

## 사이트 어댑터

AEGINEL은 두 가지 어댑터 방식을 사용합니다:

### 1. 전용 어댑터 (Hand-tuned)

각 LLM 사이트의 DOM 구조에 맞게 정밀 튜닝된 어댑터입니다.

#### ChatGPT Adapter

| 항목 | 셀렉터 |
|------|--------|
| 입력 | `#prompt-textarea`, `div.ProseMirror[contenteditable]`, `textarea[data-id="root"]` |
| 전송 | `[data-testid="send-button"]`, `button[aria-label="Send prompt"]`, `form button[type="submit"]` |
| 응답 | `.markdown.prose`, `[data-message-author-role="assistant"] .markdown` |
| 스트리밍 | `.result-streaming`, `[data-testid="stop-button"]` |

#### Claude Adapter

| 항목 | 셀렉터 |
|------|--------|
| 입력 | `div.ProseMirror[contenteditable]`, `div[contenteditable].is-editor-empty`, `fieldset div[contenteditable]` |
| 전송 | `button[aria-label="Send Message"]`, `button[aria-label="Send message"]`, `fieldset button:last-of-type` |
| 응답 | `div.font-claude-message`, `[data-testid="chat-message-content"]` |
| 스트리밍 | `[data-is-streaming="true"]` |

#### Gemini Adapter

| 항목 | 셀렉터 |
|------|--------|
| 입력 | `.ql-editor[contenteditable]`, `div[contenteditable][aria-label*="prompt"]`, `rich-textarea div[contenteditable]` |
| 전송 | `button[aria-label="Send message"]`, `button.send-button` |
| 응답 | `.model-response-text`, `message-content .markdown` |
| 스트리밍 | `.streaming`, `[data-is-streaming]` |

### 2. Generic 어댑터 (Registry-based)

`registry.ts`에 정의된 설정을 기반으로 자동 생성되는 범용 어댑터입니다. 각 사이트별로 다음 항목을 설정합니다:

| 설정 항목 | 설명 |
|----------|------|
| `id` | 사이트 식별자 |
| `name` | 표시명 |
| `hostnames` | 매칭할 호스트명 배열 |
| `pathPrefix` | 경로 프리픽스 (선택, 예: `/chat`) |
| `inputSelectors` | 입력 요소 CSS 셀렉터 배열 |
| `submitSelectors` | 전송 버튼 CSS 셀렉터 배열 |
| `responseSelectors` | LLM 응답 컨테이너 CSS 셀렉터 배열 |
| `warningAnchorSelectors` | 경고 배너 앵커 CSS 셀렉터 배열 |
| `streamingSelectors` | 스트리밍 상태 감지 CSS 셀렉터 배열 |

### ProseMirror 호환 텍스트 삽입

ProseMirror(ChatGPT, Claude)에서 가명화 텍스트를 올바르게 삽입하기 위해:

1. `Selection API`로 기존 텍스트 전체 선택
2. `document.execCommand('insertText')`로 프레임워크 입력 파이프라인 통과
3. Fallback: `InputEvent` (`inputType: 'insertText'`) + `compositionend` 이벤트 발생
4. React/Next.js 상태 동기화를 위한 `input`, `change` 이벤트 추가 발생

---

## 기술 스택

| 범주 | 기술 |
|------|------|
| **Runtime** | Chrome Extension Manifest V3 |
| **Language** | TypeScript 5.6 |
| **UI Framework** | React 18.3 |
| **Styling** | Tailwind CSS 3.4 + Shadow DOM scoped CSS |
| **Build** | Vite 5.4 + @crxjs/vite-plugin 2.0 |
| **ML Runtime** | Transformers.js 3.8 + ONNX Runtime Web (WASM SIMD) |
| **Guard Model** | DistilBERT multilingual (INT8 ONNX, 129.5MB, 8개 언어) |
| **Testing** | Vitest 4.0 (28 tests) |
| **i18n** | 20개 언어 (en, es, pt, fr, de, ja, ko, zh, it, nl, ru, ar, tr, pl, vi, id, th, hi, sv, cs) |

---

## 파일 구조

```
├── manifest.json                       # Chrome MV3 매니페스트 (28개 사이트 URL 패턴)
├── package.json                        # 의존성 및 스크립트
├── vite.config.ts                      # Vite + CRXJS 빌드 설정
├── tsconfig.json                       # TypeScript 설정
├── tailwind.config.js                  # Tailwind CSS 설정
├── postcss.config.js                   # PostCSS 설정
│
├── src/
│   ├── background/
│   │   └── service-worker.ts           # 백그라운드 서비스 워커 (메시지 핸들러, 배지)
│   │
│   ├── content/
│   │   ├── index.ts                    # 컨텐츠 스크립트 (입력 감시, 제출 가로채기)
│   │   ├── overlay/
│   │   │   ├── warning-banner.ts       # Shadow DOM 배너/모달 (4종)
│   │   │   └── styles.css              # 오버레이 전용 CSS
│   │   └── sites/
│   │       ├── base.ts                 # SiteAdapter 인터페이스 + 공통 유틸
│   │       ├── chatgpt.ts              # ChatGPT 전용 어댑터
│   │       ├── claude.ts               # Claude 전용 어댑터
│   │       ├── gemini.ts               # Gemini 전용 어댑터
│   │       ├── generic.ts              # Generic 어댑터 팩토리
│   │       └── registry.ts             # 25개 사이트 설정 레지스트리
│   │
│   ├── engine/
│   │   ├── types.ts                    # 핵심 타입 정의 (ScanResult, AeginelConfig 등)
│   │   ├── config.ts                   # 설정 머지 유틸리티
│   │   ├── detector.ts                 # 9-Layer 탐지 엔진
│   │   ├── detector.test.ts            # 탐지 엔진 테스트
│   │   ├── pii-scanner.ts             # PII 패턴 매칭 (7종, 11패턴)
│   │   ├── pii-scanner.test.ts        # PII 스캐너 테스트
│   │   ├── pii-proxy.ts              # PII 가명화 엔진 (가명 생성/복원/세션)
│   │   └── pii-proxy.test.ts         # PII Proxy 테스트 (28건)
│   │
│   ├── offscreen/
│   │   ├── offscreen.html              # Offscreen Document HTML
│   │   └── offscreen.ts               # AI Guard Model 추론 (Transformers.js + ONNX)
│   │
│   ├── popup/
│   │   ├── index.html                  # 팝업 HTML 엔트리
│   │   ├── main.tsx                    # React 엔트리 포인트
│   │   ├── App.tsx                     # 메인 앱 컴포넌트
│   │   ├── styles.css                  # Tailwind 기본 스타일
│   │   ├── components/
│   │   │   ├── StatusCard.tsx          # 상태 카드 (토글, 통계)
│   │   │   ├── RiskMeter.tsx           # SVG 게이지 (위험도)
│   │   │   ├── RecentScans.tsx         # 최근 스캔 이력
│   │   │   └── SettingsPanel.tsx       # 설정 패널 (레이어, PII, 임계값)
│   │   └── hooks/
│   │       ├── useStorage.ts           # Chrome Storage 훅
│   │       └── useMessages.ts          # 메시지 전송 훅
│   │
│   ├── shared/
│   │   ├── constants.ts               # 상수 (사이트, 스토리지 키, 제한값)
│   │   ├── messages.ts                 # 메시지 타입 정의 (13종)
│   │   └── storage.ts                  # Chrome Storage 래퍼
│   │
│   └── i18n/
│       ├── index.ts                    # i18n 엔진 (t(), setLocale(), detectLocale())
│       ├── en.json                     # English (78 키)
│       ├── ko.json                     # 한국어 (78 키)
│       └── ... (18개 추가 언어 파일)
│
├── public/
│   ├── icons/                          # 확장 프로그램 아이콘 (16/32/48/128px)
│   ├── models/
│   │   └── guard/                      # AI Guard Model 파일
│   │       ├── model_quantized.onnx    # INT8 양자화 ONNX 모델 (129.5MB)
│   │       ├── tokenizer.json          # DistilBERT WordPiece vocab (2.8MB)
│   │       ├── config.json             # 모델 아키텍처 + 레이블 맵
│   │       └── labels.json             # AEGINEL 레이블 인덱스 (7종)
│   └── _locales/                       # Chrome i18n (en, ko)
│
├── data/
│   └── training/                       # Guard Model 학습 파이프라인
│       ├── train_guard.py              # 다중 레이블 분류기 학습 스크립트
│       ├── export_onnx.py              # ONNX 변환 + INT8 양자화 스크립트
│       └── aegis_guard_training_multilingual.jsonl  # 학습 데이터 (188K 샘플)
│
├── docs/
│   └── AEGINEL_Guard_Model_Research.md # Guard Model 연구 보고서
│
└── dist/                               # 빌드 결과물
```

---

## 다국어 지원 (i18n)

외부 라이브러리 없이 자체 구현한 경량 i18n 엔진으로 **20개 언어**를 지원합니다.

### 지원 언어

| # | 코드 | 언어 | # | 코드 | 언어 |
|---|------|------|---|------|------|
| 1 | `en` | English | 11 | `ru` | Русский |
| 2 | `es` | Español | 12 | `ar` | العربية |
| 3 | `pt` | Português | 13 | `tr` | Türkçe |
| 4 | `fr` | Français | 14 | `pl` | Polski |
| 5 | `de` | Deutsch | 15 | `vi` | Tiếng Việt |
| 6 | `ja` | 日本語 | 16 | `id` | Bahasa Indonesia |
| 7 | `ko` | 한국어 | 17 | `th` | ไทย |
| 8 | `zh` | 中文 | 18 | `hi` | हिन्दी |
| 9 | `it` | Italiano | 19 | `sv` | Svenska |
| 10 | `nl` | Nederlands | 20 | `cs` | Čeština |

### i18n 엔진 (`src/i18n/index.ts`)

| API | 설명 |
|-----|------|
| `t(key, params?)` | dot-path 키로 번역 문자열 반환. `t('settings.title')` → `"설정"` / `"Settings"` |
| `t(key, { count })` | `{{param}}` 보간 지원. `t('proxy.protected', { count: 3 })` → `"3개의 개인정보가 보호되었습니다"` |
| `setLocale(locale)` | 활성 언어 설정. `'auto'` 시 브라우저 언어 자동 감지 |
| `detectLocale()` | `navigator.language` 기반 자동 감지 |
| `getLocale()` | 현재 활성 언어 코드 반환 |
| `LANGUAGE_OPTIONS` | 드롭다운용 `{ code, label }[]` 배열 |

### 번역 범위

각 언어 파일은 **78개 키**를 포함하며, 다음 영역을 커버합니다:

| 영역 | 키 예시 | 설명 |
|------|---------|------|
| `guard` | `AEGINEL Guard` | 앱 제목 |
| `status.*` | `protected`, `disabled`, `noSite` | 상태 표시 |
| `stats.*` | `scans`, `blocked`, `piiProtected` | 통계 라벨 |
| `risk.*` | `low`, `medium`, `high`, `critical` | 위험도 등급 |
| `history.*` | `title`, `empty`, `clean` | 스캔 이력 |
| `settings.*` | `title`, `pii`, `threshold`, `layers` | 설정 패널 |
| `settings.layerNames.*` | 9개 탐지 레이어 이름 | 레이어 토글 |
| `banner.*` | `detected`, `blocked`, `goBack`, `sendAnyway` | 경고/차단 UI |
| `categories.*` | 10개 위협 카테고리 | 카테고리명 |
| `proxy.*` | `protected`, `confirmTitle`, `confirm`, `skip` | PII Proxy UI |

### 언어 자동 감지

`language: 'auto'` 설정 시:
1. `navigator.language` 에서 언어 코드 추출 (예: `ko-KR` → `ko`)
2. 지원 언어 목록에서 매칭
3. 매칭 실패 시 영어(`en`)로 폴백
4. `zh-*`, `pt-*` 등 지역 변형은 기본 코드로 매핑

### 폴백 체인

```
현재 언어 → 영어(en) → 키 자체 반환
```

번역이 누락된 키는 자동으로 영어 번역을 사용하며, 영어에도 없으면 키 문자열을 그대로 반환합니다.

---

## 테스트

```bash
# 전체 테스트 실행
npx vitest run

# 워치 모드
npx vitest

# 커버리지
npx vitest run --coverage
```

### 테스트 커버리지 (28건)

| 테스트 그룹 | 건수 | 내용 |
|-------------|------|------|
| pseudonymize | 6 | 7종 PII 각각 가명화 + PII 없는 경우 |
| multiple PII | 2 | 복합 PII 2-3개 동시 처리 |
| restore | 4 | 가명 복원, 복수 가명 복원, 미존재 매핑, 미포함 가명 |
| session isolation | 2 | 세션 간 교차 복원 불가, 세션 삭제 |
| consistency | 1 | 동일 PII 반복 시 같은 가명 재사용 |
| format preservation | 5 | RRN 형식, 전화번호 대시, SSN 형식, 이메일 형식, 여권 길이 |
| config respect | 2 | PII 비활성, 특정 타입 비활성 |
| getTotalProtected | 2 | 전체 보호 수 추적, 세션 삭제 시 감소 |
| edge cases | 4 | 빈 문자열, PII만 있는 텍스트, 비PII 텍스트 보존, 빈 텍스트 복원 |

---

## 라이선스

AEGINEL는 **주식회사 야타브 (YATAV Inc.)** 가 개발한 AI 보안 기술이며, **듀얼 라이선스** 모델로 오픈소스 공개됩니다.

| 사용 주체 | 라이선스 | 비용 | 조건 |
|-----------|----------|------|------|
| **개인 / 비상업적 사용** | AGPL-3.0 | 무료 | 수정 시 소스 공개 의무 |
| **기업 / 상업적 사용** | Commercial License | 유료 | 별도 계약 필요 |

### 개인 사용 (AGPL-3.0)

개인 개발자, 학생, 연구자, 비영리 단체 등 **비상업적 목적**의 사용은 [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) 하에 **무료**로 제공됩니다.

- 모든 기능(9-Layer 탐지 엔진, PII Proxy, 20개 언어 지원 등) 제한 없이 사용 가능
- 소스 코드 자유 열람, 수정, 재배포 가능
- 수정한 코드를 배포하거나 네트워크 서비스로 제공할 경우 **동일 라이선스(AGPL-3.0)로 소스 공개 의무**
- 개인 프로젝트, 오픈소스 프로젝트, 교육 및 연구 목적 사용 포함

### 기업 사용 (Commercial License)

기업, 상업적 서비스, 또는 AGPL-3.0의 소스 공개 의무를 원하지 않는 경우 **상용 라이선스** 구매가 필요합니다.

- AGPL-3.0 소스 공개 의무 면제
- 자사 제품 및 서비스에 통합하여 상업적 배포 가능
- 우선 기술 지원 및 SLA 보장
- 커스텀 사이트 어댑터 개발 지원
- 전용 온보딩 및 컨설팅
- 엔터프라이즈 대시보드 및 관리 콘솔

**상용 라이선스 문의:** contact@yatav.com

### FAQ

| 질문 | 답변 |
|------|------|
| 개인이 무료로 사용해도 되나요? | 네. AGPL-3.0 조건 하에 모든 기능을 무료로 사용할 수 있습니다. |
| 스타트업도 무료인가요? | 상업적 목적으로 사용하거나 소스 비공개 배포가 필요한 경우 상용 라이선스가 필요합니다. |
| 수정 없이 개인적으로 설치만 하면? | 소스 공개 의무 없이 자유롭게 사용 가능합니다. |
| 사내에서 수정 후 직원에게만 배포하면? | 기업의 상업적 활동에 해당하므로 상용 라이선스가 필요합니다. |
| 오픈소스 프로젝트에 포함하려면? | AGPL-3.0 호환 라이선스의 프로젝트라면 자유롭게 포함할 수 있습니다. |
| 새로운 AI 서비스를 추가하고 싶으면? | `registry.ts`에 설정 객체를 추가하고 `manifest.json`에 URL 패턴을 추가하면 됩니다. |

---

Copyright (c) 2024-2026 주식회사 야타브 (YATAV Inc.). All rights reserved.

This software is licensed under the AGPL-3.0 for non-commercial use. Commercial use requires a separate license. See above for details.
