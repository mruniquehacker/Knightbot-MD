'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { parseMessage } = require('../core/parser');
const { evaluateExpression, formatResult } = require('../core/calculator');
const { createStore } = require('../core/store');
const { isOwner } = require('../core/security');
const { buildChatRequest, extractAssistantText, createAiProvider } = require('../core/ai');
const { createRateLimiter } = require('../core/rate-limit');
const { createAssistant } = require('../core/assistant');

const baseConfig = {
  botName: 'Levanter', botOwner: 'Owner', ownerNumber: '123456789', prefix: '.', alternatePrefixes: ['/'],
  timezone: 'UTC', commandMode: 'public', maxMessageLength: 4096, maxNotes: 10, maxConversationMessages: 6,
  processedMessageTtlMs: 60_000, rateLimitWindowMs: 60_000, rateLimitMax: 3, directAi: true, groupAi: false,
  aiProvider: 'disabled', aiBaseUrl: 'https://api.example.test/v1', aiModel: '', aiApiKey: '', aiTimeoutMs: 2_000,
  aiMaxTokens: 100, aiTemperature: 0.4, systemPrompt: 'test', logLevel: 'error', logMessageContent: false,
  allowFromMe: true, dataPath: path.join(os.tmpdir(), `levanter-test-${process.pid}.json`),
};

function message(text, overrides = {}) {
  const { key: keyOverrides = {}, message: messageOverrides = {}, ...rest } = overrides;
  return {
    key: { remoteJid: '123456789@s.whatsapp.net', id: 'msg-1', ...keyOverrides },
    message: { conversation: text, ...messageOverrides },
    ...rest,
  };
}

function fakeSock(sent = []) {
  return { user: { id: '999999999:1@s.whatsapp.net' }, sendMessage: async (jid, payload) => sent.push({ jid, payload }) };
}

test('parser recognizes configurable prefixes and preserves arguments', () => {
  const parsed = parseMessage(message('/calc 2 + 3'), baseConfig);
  assert.equal(parsed.isCommand, true);
  assert.equal(parsed.command, 'calc');
  assert.equal(parsed.args, '2 + 3');
  assert.equal(parsed.prefix, '/');
});

test('parser extracts mentions and quoted participants', () => {
  const parsed = parseMessage(message('hello', { message: { extendedTextMessage: { text: 'hello', contextInfo: { mentionedJid: ['999999999@s.whatsapp.net'], participant: '999999999@s.whatsapp.net' } } } }), { ...baseConfig, botJid: '999999999@s.whatsapp.net' });
  assert.equal(parsed.isMentioned, true);
  assert.equal(parsed.isReplyToBot, true);
});

test('calculator evaluates arithmetic without arbitrary code execution', () => {
  assert.equal(formatResult(evaluateExpression('2 + 3 * (4 - 1)')), '11');
  assert.equal(formatResult(evaluateExpression('-2^2')), '4');
  assert.throws(() => evaluateExpression('process.exit()'), /Unsupported character/);
  assert.throws(() => evaluateExpression('1'.repeat(121)), /limited/);
});

test('store persists separate notes, conversations, settings, and deduplication state', () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-store-')), 'state.json');
  const store = createStore(filePath);
  store.setMode('private');
  store.addNote('123456789@s.whatsapp.net', 'remember this', 10);
  store.appendConversation('chat', [{ role: 'user', content: 'hi' }], 6);
  assert.equal(store.getMode(), 'private');
  assert.equal(store.getNotes('123456789@s.whatsapp.net').length, 1);
  assert.equal(store.getConversation('chat', 6)[0].content, 'hi');
  assert.equal(store.claimMessage('event-1', 60_000, 1000), true);
  assert.equal(store.claimMessage('event-1', 60_000, 1001), false);
});

test('owner checks normalize phone-number JIDs', () => {
  assert.equal(isOwner('123456789:7@s.whatsapp.net', { ownerNumber: '123456789' }), true);
  assert.equal(isOwner('987654321@s.whatsapp.net', { ownerNumber: '123456789' }), false);
  assert.equal(isOwner('123456789@s.whatsapp.net', { ownerNumber: '' }), false);
});

test('AI request construction uses configured values and extracts standard responses', () => {
  const config = { ...baseConfig, aiModel: 'test-model', aiApiKey: 'secret-value' };
  const request = buildChatRequest(config, [{ role: 'user', content: 'hello' }]);
  assert.equal(request.url, 'https://api.example.test/v1/chat/completions');
  assert.equal(request.body.model, 'test-model');
  assert.equal(request.headers.Authorization, 'Bearer secret-value');
  assert.equal(extractAssistantText({ choices: [{ message: { content: 'reply' } }] }), 'reply');
});

test('AI provider handles a successful compatible response without leaking request data', async () => {
  const config = { ...baseConfig, aiProvider: 'openai-compatible', aiModel: 'test-model', aiApiKey: 'secret-value' };
  let received;
  const provider = createAiProvider(config, async (url, options) => {
    received = { url, options };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
  });
  assert.equal(await provider.complete([{ role: 'user', content: 'hello' }]), 'ok');
  assert.equal(received.url, 'https://api.example.test/v1/chat/completions');
  assert.match(received.options.headers.Authorization, /^Bearer /);
});

test('assistant handles commands, rejects unauthorized owner commands, and splits long replies', async () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-assistant-')), 'state.json');
  const config = { ...baseConfig, dataPath: filePath };
  const store = createStore(filePath);
  const sent = [];
  const assistant = createAssistant({
    config,
    store,
    aiProvider: { enabled: false, complete: async () => '' },
    logger: { error() {}, warn() {}, info() {}, debug() {} },
    rateLimiter: createRateLimiter({ windowMs: 60_000, max: 3 }),
  });
  const sock = fakeSock(sent);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('.ping')] }), true);
  assert.match(sent.at(-1).payload.text, /Pong/);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('.note secret', { key: { id: 'msg-note', remoteJid: '987654321@s.whatsapp.net' } })] }), true);
  assert.match(sent.at(-1).payload.text, /restricted/);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('.calc 10 / 2', { key: { id: 'msg-2' } })] }), true);
  assert.match(sent.at(-1).payload.text, /5/);
});


test('duplicate events are ignored and empty input does not crash', async () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-duplicate-')), 'state.json');
  const config = { ...baseConfig, dataPath: filePath };
  const store = createStore(filePath);
  const sent = [];
  const assistant = createAssistant({
    config,
    store,
    aiProvider: { enabled: false, complete: async () => '' },
    logger: { error() {}, warn() {}, info() {}, debug() {} },
    rateLimiter: createRateLimiter({ windowMs: 60_000, max: 3 }),
  });
  const sock = fakeSock(sent);
  const event = { type: 'notify', messages: [message('.ping', { key: { id: 'same-id' } })] };
  assert.equal(await assistant.handleMessage(sock, event), true);
  assert.equal(await assistant.handleMessage(sock, event), true);
  assert.equal(sent.length, 1);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('', { key: { id: 'empty-id' }, message: {} })] }), false);
});

test('private mode blocks non-owner commands and permits the owner', async () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-private-')), 'state.json');
  const config = { ...baseConfig, dataPath: filePath };
  const store = createStore(filePath);
  store.setMode('private');
  const sent = [];
  const assistant = createAssistant({
    config,
    store,
    aiProvider: { enabled: false, complete: async () => '' },
    logger: { error() {}, warn() {}, info() {}, debug() {} },
    rateLimiter: createRateLimiter({ windowMs: 60_000, max: 3 }),
  });
  const sock = fakeSock(sent);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('.ping', { key: { id: 'private-user', remoteJid: '987654321@s.whatsapp.net' } })] }), true);
  assert.match(sent.at(-1).payload.text, /private mode/);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('.ping', { key: { id: 'private-owner' } })] }), true);
  assert.match(sent.at(-1).payload.text, /Pong/);
});

test('AI failures produce a safe user message and long replies are chunked', async () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-ai-')), 'state.json');
  const config = { ...baseConfig, dataPath: filePath, maxMessageLength: 20 };
  const store = createStore(filePath);
  const sent = [];
  const assistant = createAssistant({
    config,
    store,
    aiProvider: { enabled: true, complete: async () => 'This is a response longer than twenty characters.' },
    logger: { error() {}, warn() {}, info() {}, debug() {} },
    rateLimiter: createRateLimiter({ windowMs: 60_000, max: 3 }),
  });
  const sock = fakeSock(sent);
  assert.equal(await assistant.handleMessage(sock, { type: 'notify', messages: [message('hello', { key: { id: 'ai-long' } })] }), true);
  assert.ok(sent.length > 1);
  assert.ok(sent.every((item) => item.payload.text.length <= 20));

  const failingAssistant = createAssistant({
    config: { ...config, dataPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-ai-fail-')), 'state.json') },
    store: createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-ai-fail-store-')), 'state.json')),
    aiProvider: { enabled: true, complete: async () => { const error = new Error('secret provider details'); error.code = 'AI_HTTP_ERROR'; throw error; } },
    logger: { error() {}, warn() {}, info() {}, debug() {} },
    rateLimiter: createRateLimiter({ windowMs: 60_000, max: 3 }),
  });
  const failureSent = [];
  await failingAssistant.handleMessage(fakeSock(failureSent), { type: 'notify', messages: [message('.ai hello', { key: { id: 'ai-fail' } })] });
  const failureText = failureSent.map((item) => item.payload.text).join('');
  assert.match(failureText, /temporarily unavailable/);
  assert.doesNotMatch(failureText, /secret/);
});


test('private mode blocks ordinary AI messages from non-owners', async () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'levanter-private-ai-')), 'state.json');
  const config = { ...baseConfig, dataPath: filePath, aiProvider: 'openai-compatible', aiModel: 'test-model', aiApiKey: 'test-key' };
  const store = createStore(filePath);
  store.setMode('private');
  let providerCalled = false;
  const assistant = createAssistant({
    config,
    store,
    aiProvider: { enabled: true, complete: async () => { providerCalled = true; return 'should not run'; } },
    logger: { error() {}, warn() {}, info() {}, debug() {} },
    rateLimiter: createRateLimiter({ windowMs: 60_000, max: 3 }),
  });
  const sent = [];
  await assistant.handleMessage(fakeSock(sent), { type: 'notify', messages: [message('hello', { key: { id: 'private-ai-user', remoteJid: '987654321@s.whatsapp.net' } })] });
  assert.equal(providerCalled, false);
  assert.match(sent.at(-1).payload.text, /private mode/);
});
