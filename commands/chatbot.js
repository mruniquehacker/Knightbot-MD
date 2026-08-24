'use strict';

const { createConfig } = require('../core/config');
const { createStore } = require('../core/store');
const { createAiProvider } = require('../core/ai');
const { createAssistant } = require('../core/assistant');
const { createRateLimiter } = require('../core/rate-limit');
const { createLogger } = require('../core/logger');
const { parseMessage } = require('../core/parser');
const { getChatbot, setChatbot, removeChatbot } = require('../sql');

const config = createConfig();
const store = createStore(config.dataPath);
const logger = createLogger(config);
const rateLimiter = createRateLimiter({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax });
const assistant = createAssistant({
  config: { ...config, groupAi: true },
  store,
  aiProvider: createAiProvider(config),
  logger,
  rateLimiter,
});

async function handleChatbotCommand(sock, chatId, message, match) {
  const action = String(match || '').trim().toLowerCase();
  if (!action) {
    return sock.sendMessage(chatId, {
      text: `*CHATBOT SETUP*\n\n.chatbot on — enable replies when the bot is mentioned\n.chatbot off — disable group chatbot replies`,
    });
  }
  if (action === 'on') {
    if ((await getChatbot(chatId))?.enabled) return sock.sendMessage(chatId, { text: 'Chatbot is already enabled for this group.' });
    await setChatbot(chatId, true);
    return sock.sendMessage(chatId, { text: 'Chatbot enabled. Mention the bot or reply to one of its messages to ask a question.' });
  }
  if (action === 'off') {
    if (!(await getChatbot(chatId))?.enabled) return sock.sendMessage(chatId, { text: 'Chatbot is already disabled for this group.' });
    await removeChatbot(chatId);
    return sock.sendMessage(chatId, { text: 'Chatbot disabled for this group.' });
  }
  return sock.sendMessage(chatId, { text: 'Invalid chatbot option. Use .chatbot on or .chatbot off.' });
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
  const configForMessage = { ...config, botJid: sock.user?.id || '' };
  const parsed = parseMessage(message, configForMessage);
  if (!(await getChatbot(chatId))?.enabled || !parsed.isGroup || (!parsed.isMentioned && !parsed.isReplyToBot)) return false;
  return assistant.askAi(sock, parsed, userMessage);
}

module.exports = { handleChatbotCommand, handleChatbotResponse };
