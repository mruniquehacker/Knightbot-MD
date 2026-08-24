'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function asBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function asInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanOwnerNumber(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function normalizeBaseUrl(value) {
  return String(value || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function createConfig(env = process.env) {
  const dataPath = env.DATA_PATH || path.join(process.cwd(), 'data', 'levanter-state.json');
  const ownerNumber = cleanOwnerNumber(env.OWNER_NUMBER || env.BOT_OWNER_NUMBER);
  const aiApiKey = env.AI_API_KEY || env.OPENAI_API_KEY || '';
  const aiProvider = String(env.AI_PROVIDER || 'disabled').toLowerCase();

  return Object.freeze({
    botName: env.BOT_NAME || env.ASSISTANT_NAME || 'Levanter',
    botOwner: env.BOT_OWNER || 'Owner',
    ownerNumber,
    prefix: env.PREFIX || env.COMMAND_PREFIX || '.',
    alternatePrefixes: String(env.ALTERNATE_PREFIXES || '/').split(',').map((item) => item.trim()).filter(Boolean),
    timezone: env.TIMEZONE || 'UTC',
    commandMode: ['public', 'private'].includes(String(env.BOT_MODE || env.COMMAND_MODE || 'public').toLowerCase())
      ? String(env.BOT_MODE || env.COMMAND_MODE || 'public').toLowerCase()
      : 'public',
    dataPath,
    maxMessageLength: asInteger(env.MAX_MESSAGE_LENGTH, 4096, { min: 128, max: 4096 }),
    maxNotes: asInteger(env.MAX_NOTES, 100, { min: 1, max: 1000 }),
    maxConversationMessages: asInteger(env.MAX_CONVERSATION_MESSAGES, 12, { min: 2, max: 50 }),
    processedMessageTtlMs: asInteger(env.PROCESSED_MESSAGE_TTL_MS, 24 * 60 * 60 * 1000, { min: 60_000, max: 30 * 24 * 60 * 60 * 1000 }),
    rateLimitWindowMs: asInteger(env.RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 3_600_000 }),
    rateLimitMax: asInteger(env.RATE_LIMIT_MAX, 10, { min: 1, max: 100 }),
    directAi: asBoolean(env.DIRECT_AI, true),
    groupAi: asBoolean(env.GROUP_AI, false),
    aiProvider,
    aiBaseUrl: normalizeBaseUrl(env.AI_BASE_URL),
    aiModel: env.AI_MODEL || '',
    aiApiKey,
    aiTimeoutMs: asInteger(env.AI_TIMEOUT_MS, 30_000, { min: 2_000, max: 120_000 }),
    aiMaxTokens: asInteger(env.AI_MAX_TOKENS, 700, { min: 32, max: 4096 }),
    aiTemperature: Number.isFinite(Number(env.AI_TEMPERATURE)) ? Number(env.AI_TEMPERATURE) : 0.4,
    systemPrompt: env.AI_SYSTEM_PROMPT || 'You are Levanter, a concise and helpful personal WhatsApp assistant. Protect private information, do not claim actions you did not perform, and keep replies readable on a phone.',
    logLevel: env.LOG_LEVEL || 'info',
    logMessageContent: asBoolean(env.LOG_MESSAGE_CONTENT, false),
    allowFromMe: asBoolean(env.ALLOW_FROM_ME, true),
    sendConnectMessage: asBoolean(env.SEND_CONNECT_MESSAGE, false),
  });
}

function validateConfig(config) {
  const errors = [];
  const warnings = [];
  if (!config.ownerNumber) warnings.push('OWNER_NUMBER is not configured; owner-only commands will reject every sender.');
  if (!['disabled', 'openai-compatible'].includes(config.aiProvider)) errors.push(`Unsupported AI_PROVIDER: ${config.aiProvider}`);
  if (config.aiProvider !== 'disabled' && !config.aiApiKey) errors.push('AI_PROVIDER is enabled but AI_API_KEY or OPENAI_API_KEY is missing.');
  if (config.aiProvider !== 'disabled' && !config.aiModel) errors.push('AI_MODEL is required when an AI provider is enabled.');
  if (config.aiTemperature < 0 || config.aiTemperature > 2) errors.push('AI_TEMPERATURE must be between 0 and 2.');
  if (!config.prefix || config.prefix.length > 2) errors.push('PREFIX must be one or two characters.');
  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { createConfig, validateConfig, cleanOwnerNumber };
