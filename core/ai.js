'use strict';

function buildChatRequest(config, messages) {
  if (!config.aiModel) throw new Error('AI_MODEL is not configured');
  return {
    url: `${config.aiBaseUrl}/chat/completions`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: {
      model: config.aiModel,
      messages,
      temperature: config.aiTemperature,
      max_tokens: config.aiMaxTokens,
    },
  };
}

function extractAssistantText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : part?.text || '').join('').trim();
  }
  return '';
}

function createAiProvider(config, fetchImpl = globalThis.fetch) {
  return Object.freeze({
    enabled: config.aiProvider !== 'disabled',
    async complete(messages) {
      if (config.aiProvider === 'disabled') {
        const error = new Error('AI provider is disabled');
        error.code = 'AI_DISABLED';
        throw error;
      }
      if (config.aiProvider !== 'openai-compatible') {
        const error = new Error(`Unsupported AI provider: ${config.aiProvider}`);
        error.code = 'AI_PROVIDER_UNSUPPORTED';
        throw error;
      }
      if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable in this Node.js runtime');

      const request = buildChatRequest(config, messages);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.aiTimeoutMs);
      try {
        const response = await fetchImpl(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(`AI provider returned HTTP ${response.status}`);
          error.code = 'AI_HTTP_ERROR';
          error.status = response.status;
          throw error;
        }
        const text = extractAssistantText(payload);
        if (!text) {
          const error = new Error('AI provider returned no assistant text');
          error.code = 'AI_EMPTY_RESPONSE';
          throw error;
        }
        return text;
      } catch (error) {
        if (error?.name === 'AbortError') {
          const timeoutError = new Error('AI provider timed out');
          timeoutError.code = 'AI_TIMEOUT';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}

module.exports = { buildChatRequest, extractAssistantText, createAiProvider };
