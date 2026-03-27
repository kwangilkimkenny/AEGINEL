// ── Site Registry ─────────────────────────────────────────────────────────
// Configuration-driven site definitions for the generic adapter.
// Each entry defines CSS selectors and matching rules for an AI service.

export interface SiteConfig {
  id: string;
  name: string;
  hostnames: string[];
  /** Optional path prefix match (e.g., '/chat' for huggingface.co/chat) */
  pathPrefix?: string;
  inputSelectors: string[];
  submitSelectors: string[];
  responseSelectors: string[];
  warningAnchorSelectors: string[];
  streamingSelectors: string[];
  /** If true, use innerText for contenteditable instead of textContent */
  useInnerText?: boolean;
}

/**
 * Universal fallback selectors used when all site-specific selectors fail.
 * These target stable ARIA/role attributes rather than brittle class names.
 */
export const FALLBACK_INPUT_SELECTORS = [
  '[role="textbox"][contenteditable="true"]',
  'textarea[rows]',
  'textarea',
  'div[contenteditable="true"]',
];

export const FALLBACK_SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button[aria-label*="Send" i]',
  'button[aria-label*="Submit" i]',
  'button[aria-label*="보내기"]',
  'button[aria-label*="전송"]',
  'button[aria-label*="제출"]',
  'button[data-testid*="send" i]',
];

export const FALLBACK_RESPONSE_SELECTORS = [
  '[class*="markdown"]',
  '[class*="prose"]',
  '[class*="response"]',
  '[class*="assistant"]',
  '[class*="message"]',
];

export const siteRegistry: SiteConfig[] = [
  // ── Microsoft Copilot ──
  {
    id: 'copilot',
    name: 'Microsoft Copilot',
    hostnames: ['copilot.microsoft.com', 'www.bing.com'],
    pathPrefix: undefined,
    inputSelectors: [
      '#searchbox',
      'textarea[placeholder*="message"]',
      'cib-serp cib-action-bar textarea',
      'textarea[id*="input"]',
      'div[contenteditable="true"][role="textbox"]',
      '[role="textbox"]',
      'textarea',
    ],
    submitSelectors: [
      'button[aria-label="Submit"]',
      'button[aria-label="Send"]',
      'button[title="Submit"]',
      'cib-action-bar button[type="submit"]',
      'button[type="submit"]',
    ],
    responseSelectors: [
      'cib-message-group[source="bot"] .content',
      '[data-content][data-author="bot"]',
      '.response-message-group .content',
    ],
    warningAnchorSelectors: ['cib-action-bar', '#searchbox', 'main'],
    streamingSelectors: ['cib-typing-indicator', '.typing-indicator'],
  },

  // ── Perplexity AI ──
  {
    id: 'perplexity',
    name: 'Perplexity',
    hostnames: ['www.perplexity.ai', 'perplexity.ai'],
    inputSelectors: [
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      'textarea[autofocus]',
      'div[contenteditable="true"][role="textbox"]',
      '[role="textbox"]',
      'textarea',
    ],
    submitSelectors: [
      'button[aria-label="Submit"]',
      'button[aria-label="Send"]',
      'button[aria-label="제출"]',
      'button[aria-label="보내기"]',
      'button[aria-label*="submit" i]',
      'button[aria-label*="send" i]',
      'button svg[data-icon="arrow-right"]',
      'button[type="submit"]',
      'button[class*="submit" i]',
      'button[class*="send" i]',
      'textarea + button',
      'textarea ~ button',
    ],
    responseSelectors: [
      '.prose',
      '[class*="answer"]',
      '.markdown-content',
      '[class*="response"]',
      '[class*="result"]',
    ],
    warningAnchorSelectors: ['[class*="search-input"]', '[class*="query"]', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="streaming"]'],
  },

  // ── Mistral Le Chat ──
  {
    id: 'mistral',
    name: 'Mistral Le Chat',
    hostnames: ['chat.mistral.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
      'button[aria-label="Send message"]',
    ],
    responseSelectors: [
      '.prose',
      '[class*="assistant"]',
      '[class*="message-content"]',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="streaming"]', '[class*="loading"]'],
  },

  // ── Cohere Coral ──
  {
    id: 'cohere',
    name: 'Cohere Coral',
    hostnames: ['coral.cohere.com'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '[class*="assistant"]',
      '.markdown',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="streaming"]'],
  },

  // ── HuggingChat ──
  {
    id: 'huggingchat',
    name: 'HuggingChat',
    hostnames: ['huggingface.co'],
    pathPrefix: '/chat',
    inputSelectors: [
      'textarea[placeholder*="Ask"]',
      'textarea[enterkeyhint="send"]',
      'textarea',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'form button:last-of-type',
    ],
    responseSelectors: [
      '.prose',
      '[class*="assistant-message"]',
      '.markdown',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Poe ──
  {
    id: 'poe',
    name: 'Poe',
    hostnames: ['poe.com'],
    inputSelectors: [
      'textarea[class*="TextArea"]',
      'textarea[placeholder*="message"]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[class*="SendButton"]',
      'button[aria-label="Send message"]',
      'button[class*="send"]',
    ],
    responseSelectors: [
      '[class*="Message_botMessageBubble"]',
      '[class*="bot_message"]',
      '.markdown',
    ],
    warningAnchorSelectors: ['[class*="InputContainer"]', 'footer', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="Pending"]'],
  },

  // ── DeepSeek ──
  {
    id: 'deepseek',
    name: 'DeepSeek',
    hostnames: ['chat.deepseek.com'],
    inputSelectors: [
      '#chat-input',
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="Message" i]',
      'textarea[placeholder*="Send" i]',
      'textarea[class*="chat"]',
      'textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[aria-label*="Send" i]',
      'button[aria-label*="send" i]',
      'div[role="button"][aria-label*="send" i]',
      'button[class*="send" i]',
      'button[class*="Send" i]',
      'button[type="submit"]',
      'button svg[class*="send" i]',
    ],
    responseSelectors: [
      '.ds-markdown',
      '.markdown-body',
      '[class*="message-content"]',
      '[class*="assistant"]',
      '[class*="response"]',
      '.prose',
    ],
    warningAnchorSelectors: [
      '#chat-input',
      '[class*="chat-input"]',
      '[class*="input-wrapper"]',
      '[class*="input-container"]',
      '[class*="input-area"]',
      '[class*="composer"]',
      'textarea',
      'form',
      'main',
    ],
    streamingSelectors: [
      '[class*="loading"]',
      '[class*="streaming"]',
      '[class*="typing"]',
      '[class*="generating"]',
    ],
  },

  // ── You.com ──
  {
    id: 'you',
    name: 'You.com',
    hostnames: ['you.com'],
    inputSelectors: [
      'textarea[placeholder*="Ask"]',
      'textarea',
      'input[type="text"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Submit"]',
    ],
    responseSelectors: [
      '[class*="answer"]',
      '.markdown',
      '.prose',
    ],
    warningAnchorSelectors: ['[class*="search"]', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="streaming"]'],
  },

  // ── Phind ──
  {
    id: 'phind',
    name: 'Phind',
    hostnames: ['www.phind.com', 'phind.com'],
    inputSelectors: [
      'textarea[placeholder*="Search"]',
      'textarea[placeholder*="Ask"]',
      'textarea',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Search"]',
    ],
    responseSelectors: [
      '[class*="answer"]',
      '.markdown',
      '.prose',
    ],
    warningAnchorSelectors: ['[class*="search"]', 'form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Pi (Inflection) ──
  {
    id: 'pi',
    name: 'Pi',
    hostnames: ['pi.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
      'input[type="text"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
      'button[aria-label="Submit"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '[class*="message"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="typing"]', '[class*="loading"]'],
  },

  // ── Meta AI ──
  {
    id: 'meta',
    name: 'Meta AI',
    hostnames: ['www.meta.ai', 'meta.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[aria-label="Send"]',
      'button[type="submit"]',
      'div[role="button"][aria-label*="Send"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '[class*="assistant"]',
      '.markdown',
    ],
    warningAnchorSelectors: ['form', '[class*="input"]', 'main'],
    streamingSelectors: ['[class*="typing"]', '[class*="loading"]'],
  },

  // ── Grok (xAI) ──
  {
    id: 'grok',
    name: 'Grok',
    hostnames: ['grok.com', 'x.com'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
      'div[role="textbox"]',
    ],
    submitSelectors: [
      'button[aria-label="Send"]',
      'button[type="submit"]',
      'button[data-testid="send"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '[class*="message-content"]',
      '.markdown',
    ],
    warningAnchorSelectors: ['form', '[class*="composer"]', 'main'],
    streamingSelectors: ['[class*="streaming"]', '[class*="loading"]'],
  },

  // ── Character.AI ──
  {
    id: 'characterai',
    name: 'Character.AI',
    hostnames: ['character.ai', 'beta.character.ai'],
    inputSelectors: [
      'textarea[placeholder*="Message"]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[aria-label="Send"]',
      'button[type="submit"]',
      'button[class*="send"]',
    ],
    responseSelectors: [
      '[class*="char-message"]',
      '[class*="swiper-slide"]',
      '[class*="message"]',
    ],
    warningAnchorSelectors: ['[class*="input"]', 'form', 'main'],
    streamingSelectors: ['[class*="typing"]', '[class*="loading"]'],
  },

  // ── Jasper ──
  {
    id: 'jasper',
    name: 'Jasper',
    hostnames: ['app.jasper.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
      'button[aria-label="Generate"]',
    ],
    responseSelectors: [
      '[class*="output"]',
      '[class*="response"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', '[class*="editor"]', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="generating"]'],
  },

  // ── WriteSonic / Chatsonic ──
  {
    id: 'writesonic',
    name: 'WriteSonic',
    hostnames: ['app.writesonic.com'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '.markdown',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Notion AI ──
  {
    id: 'notion',
    name: 'Notion AI',
    hostnames: ['www.notion.so', 'notion.so'],
    inputSelectors: [
      '[class*="notion-ai"] textarea',
      '[class*="notion-ai"] div[contenteditable="true"]',
      'div[contenteditable="true"][data-content-editable-leaf]',
    ],
    submitSelectors: [
      '[class*="notion-ai"] button[type="submit"]',
      '[class*="notion-ai"] button[aria-label="Send"]',
      'div[role="button"][aria-label*="AI"]',
    ],
    responseSelectors: [
      '[class*="notion-ai-response"]',
      '[class*="ai-content"]',
    ],
    warningAnchorSelectors: ['[class*="notion-ai"]', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="generating"]'],
  },

  // ── GitHub Copilot Chat ──
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    hostnames: ['github.com'],
    pathPrefix: '/copilot',
    inputSelectors: [
      'textarea[id*="copilot"]',
      'textarea[placeholder*="Ask"]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '[class*="copilot-response"]',
      '.markdown-body',
      '.prose',
    ],
    warningAnchorSelectors: ['form', '[class*="copilot"]', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="streaming"]'],
  },

  // ── Groq ──
  {
    id: 'groq',
    name: 'Groq',
    hostnames: ['groq.com'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '.markdown',
      '[class*="assistant"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="streaming"]', '[class*="loading"]'],
  },

  // ── AI Studio (Google) ──
  {
    id: 'aistudio',
    name: 'Google AI Studio',
    hostnames: ['aistudio.google.com'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
      '.ql-editor',
    ],
    submitSelectors: [
      'button[aria-label="Run"]',
      'button[aria-label="Send"]',
      'button[type="submit"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '.markdown',
      '.prose',
    ],
    warningAnchorSelectors: ['[class*="prompt"]', 'form', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="running"]'],
  },

  // ── Anthropic Console (API Playground) ──
  {
    id: 'anthropic-console',
    name: 'Anthropic Console',
    hostnames: ['console.anthropic.com'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
      'button[aria-label="Run"]',
    ],
    responseSelectors: [
      '[class*="response"]',
      '[class*="assistant"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', '[class*="playground"]', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="streaming"]'],
  },

  // ── OpenRouter ──
  {
    id: 'openrouter',
    name: 'OpenRouter',
    hostnames: ['openrouter.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '.markdown',
      '[class*="assistant"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Ollama Web UI (Open WebUI) ──
  {
    id: 'openwebui',
    name: 'Open WebUI',
    hostnames: ['localhost', '127.0.0.1'],
    inputSelectors: [
      'textarea#chat-textarea',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[id*="send"]',
    ],
    responseSelectors: [
      '[class*="assistant"]',
      '.markdown',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Together AI ──
  {
    id: 'together',
    name: 'Together AI',
    hostnames: ['api.together.ai', 'together.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '.markdown',
      '[class*="response"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Replicate ──
  {
    id: 'replicate',
    name: 'Replicate',
    hostnames: ['replicate.com'],
    inputSelectors: [
      'textarea',
      'input[type="text"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button:has(> span:contains("Run"))',
    ],
    responseSelectors: [
      '[class*="output"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]', '[class*="running"]'],
  },

  // ── Vercel AI Playground ──
  {
    id: 'vercel-ai',
    name: 'Vercel AI',
    hostnames: ['sdk.vercel.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '.markdown',
      '[class*="assistant"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── Dify ──
  {
    id: 'dify',
    name: 'Dify',
    hostnames: ['cloud.dify.ai', 'dify.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      '.markdown',
      '[class*="response"]',
      '.prose',
    ],
    warningAnchorSelectors: ['form', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },

  // ── ChatBot Arena (LMSYS) ──
  {
    id: 'chatbot-arena',
    name: 'Chatbot Arena',
    hostnames: ['chat.lmsys.org', 'arena.lmsys.org', 'lmarena.ai'],
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'button:contains("Send")',
      '#send_btn',
    ],
    responseSelectors: [
      '.message.bot',
      '[class*="bot-message"]',
      '.markdown',
    ],
    warningAnchorSelectors: ['form', '#input-panel', 'main'],
    streamingSelectors: ['[class*="loading"]'],
  },
];
