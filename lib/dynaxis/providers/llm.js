/**
 * Dynaxis LLM provider adapter — synchronous MuAPI any-llm-models calls.
 * Distinct from async image/video Job lifecycle.
 */

import { DEFAULT_CHARACTER_LLM_MODEL, PROVIDER_MUAPI } from '../types.js';

const BASE_URL =
  typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')
    ? '/api'
    : 'https://api.muapi.ai';

/**
 * @typedef {Object} LlmChatRequest
 * @property {string} prompt
 * @property {string} [systemPrompt]
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number|null} [maxTokens]
 * @property {Array<{ role: string, content: string }>} [messages]
 */

/**
 * Build a transcript-style prompt from message history when useful.
 * MuAPI any-llm-models primarily takes a single prompt + system_prompt.
 * @param {LlmChatRequest} input
 */
export function buildLlmPrompt(input) {
  if (Array.isArray(input.messages) && input.messages.length > 0) {
    const history = input.messages
      .filter((m) => m && m.content)
      .map((m) => {
        const role = m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'User';
        return `${role}: ${m.content}`;
      })
      .join('\n');
    return history;
  }
  return String(input.prompt || '');
}

/**
 * Call MuAPI LLM endpoint (no Dynaxis Job — synchronous chat).
 * @param {string} apiKey
 * @param {LlmChatRequest} input
 */
export async function executeLlmChat(apiKey, input) {
  if (!apiKey || apiKey === 'dynaxis-local-preview') {
    const err = new Error('MuAPI key required for Character chat');
    err.code = 'MUAPI_KEY_MISSING';
    err.status = 401;
    throw err;
  }

  const model = input.model || DEFAULT_CHARACTER_LLM_MODEL;
  const prompt = buildLlmPrompt(input);
  if (!prompt.trim()) {
    const err = new Error('Chat prompt is required');
    err.code = 'LLM_PROMPT_REQUIRED';
    err.status = 400;
    throw err;
  }

  const payload = {
    prompt,
    system_prompt: input.systemPrompt || '',
    model,
    reasoning: false,
    priority: 'throughput',
    temperature: input.temperature ?? 0.8,
    max_tokens: input.maxTokens ?? null,
  };

  const url = `${BASE_URL}/api/v1/any-llm-models`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`LLM request failed: ${res.status}`);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = 'LLM_PROVIDER_ERROR';
    err.detail = String(text).slice(0, 200);
    throw err;
  }

  const json = await res.json();
  const reply =
    (Array.isArray(json.outputs) && json.outputs[0]) ||
    json.output ||
    json.result ||
    json.reply ||
    '';

  return {
    reply: String(reply || '').trim() || '…',
    model,
    provider: PROVIDER_MUAPI,
    raw: {
      // Avoid leaking oversized provider payloads to clients
      request_id: json.request_id || json.id || null,
      model,
    },
  };
}

/**
 * Test / dry-run helper — deterministic mock without network.
 */
export function mockLlmChat(input) {
  const prompt = buildLlmPrompt(input);
  return {
    reply: `Understood. (mock reply to: ${String(prompt).slice(0, 80)})`,
    model: input.model || DEFAULT_CHARACTER_LLM_MODEL,
    provider: PROVIDER_MUAPI,
    raw: { mock: true },
  };
}
