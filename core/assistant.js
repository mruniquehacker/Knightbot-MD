'use strict';

const os = require('os');
const { parseMessage } = require('./parser');
const { evaluateExpression, formatResult } = require('./calculator');
const { isOwner, canUseBot, canUseAi } = require('./security');

const CORE_COMMANDS = new Set(['help', 'menu', 'ping', 'status', 'ai', 'ask', 'chat', 'clear', 'note', 'notes', 'calc', 'time', 'mode', 'diagnostics']);
const OWNER_COMMANDS = new Set(['mode', 'diagnostics', 'note', 'notes', 'clear']);

function splitText(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return [value];
  const chunks = [];
  for (let index = 0; index < value.length; index += maxLength) chunks.push(value.slice(index, index + maxLength));
  return chunks;
}

function cleanAiInput(text, parsed, config) {
  let input = String(text || '').trim();
  if (parsed.isMentioned && config.botJid) {
    const number = String(config.botJid).split(':')[0].split('@')[0];
    input = input.replace(new RegExp(`@${number}\\b`, 'g'), '').trim();
  }
  return input || 'Hello';
}

function helpText(config) {
  return [
    `*${config.botName}* — personal assistant`,
    '',
    `${config.prefix}help — show this help`,
    `${config.prefix}ping — quick health check`,
    `${config.prefix}status — runtime status`,
    `${config.prefix}ai <message> — ask the assistant`,
    `${config.prefix}clear — clear this chat's AI context`,
    `${config.prefix}calc <expression> — safe arithmetic`,
    `${config.prefix}time — current time in ${config.timezone}`,
    `${config.prefix}note <text> — save a private note (owner only)`,
    `${config.prefix}notes — list private notes (owner only)`,
    `${config.prefix}mode public|private — access mode (owner only)`,
    `${config.prefix}diagnostics — safe diagnostics (owner only)`,
    '',
    'In private chat, ordinary messages can use AI when configured. In groups, mention the bot or reply to it and enable GROUP_AI.',
  ].join('\n');
}

function createAssistant({ config, store, aiProvider, logger, rateLimiter }) {
  async function sendText(sock, parsed, text, options = {}) {
    const chunks = splitText(text, config.maxMessageLength);
    for (let index = 0; index < chunks.length; index += 1) {
      await sock.sendMessage(parsed.chatId, {
        text: chunks[index],
        ...(index === 0 && options.quoted ? { quoted: options.quoted } : {}),
        ...(options.mentions && index === 0 ? { mentions: options.mentions } : {}),
      });
    }
  }

  function ownerOnly(parsed, command) {
    if (!OWNER_COMMANDS.has(command)) return true;
    return isOwner(parsed.senderId, config);
  }

  async function askAi(sock, parsed, userText) {
    if (!canUseBot(parsed, config, store.getMode())) {
      await sendText(sock, parsed, 'This bot is currently in private mode.');
      return true;
    }
    if (!canUseAi(parsed, config)) {
      if (parsed.isGroup && !config.groupAi) return false;
      await sendText(sock, parsed, 'AI is not enabled for this chat. Use the command in a private chat or configure GROUP_AI=true.');
      return true;
    }
    const key = `ai:${parsed.senderId}`;
    if (!rateLimiter.allow(key)) {
      await sendText(sock, parsed, 'You are sending requests too quickly. Please wait a moment and try again.');
      return true;
    }
    const input = cleanAiInput(userText, parsed, config);
    const history = store.getConversation(parsed.chatId, config.maxConversationMessages);
    const messages = [
      { role: 'system', content: config.systemPrompt },
      ...history,
      { role: 'user', content: input },
    ];
    try {
      const response = await aiProvider.complete(messages);
      store.appendConversation(parsed.chatId, [
        { role: 'user', content: input },
        { role: 'assistant', content: response },
      ], config.maxConversationMessages);
      logger.info('ai_response', { chatId: parsed.chatId, senderId: parsed.senderId, characters: response.length });
      const mentions = parsed.isGroup ? [parsed.senderId] : undefined;
      await sendText(sock, parsed, parsed.isGroup ? `@${parsed.senderId.split('@')[0]} ${response}` : response, { quoted: parsed.message, mentions });
    } catch (error) {
      logger.error('ai_failure', { code: error.code || 'AI_ERROR', status: error.status });
      const message = error.code === 'AI_DISABLED' ? 'AI is not configured. Set AI_PROVIDER, AI_MODEL, and AI_API_KEY.' : 'The AI provider is temporarily unavailable. Please try again later.';
      await sendText(sock, parsed, message, { quoted: parsed.message });
    }
    return true;
  }

  async function handleCommand(sock, parsed) {
    if (!CORE_COMMANDS.has(parsed.command)) return false;
    if (!canUseBot(parsed, config, store.getMode())) {
      await sendText(sock, parsed, 'This bot is currently in private mode.');
      return true;
    }
    if (!ownerOnly(parsed, parsed.command)) {
      await sendText(sock, parsed, 'This command is restricted to the configured owner.');
      logger.warn('unauthorized_command', { command: parsed.command, senderId: parsed.senderId, chatId: parsed.chatId });
      return true;
    }

    switch (parsed.command) {
      case 'help':
      case 'menu':
        await sendText(sock, parsed, helpText(config));
        return true;
      case 'ping':
        await sendText(sock, parsed, `Pong. ${config.botName} is responding.`);
        return true;
      case 'status':
        await sendText(sock, parsed, `*Status*\nBot: ${config.botName}\nMode: ${store.getMode()}\nAI: ${aiProvider.enabled ? `${config.aiProvider}/${config.aiModel || 'unconfigured'}` : 'disabled'}\nUptime: ${Math.floor(process.uptime())}s`);
        return true;
      case 'time': {
        const now = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone: config.timezone }).format(new Date());
        await sendText(sock, parsed, `Current time: ${now}`);
        return true;
      }
      case 'calc':
        try {
          await sendText(sock, parsed, `Result: ${formatResult(evaluateExpression(parsed.args))}`);
        } catch (error) {
          await sendText(sock, parsed, `Calculator error: ${error.message}`);
        }
        return true;
      case 'note':
        if (!parsed.args) { await sendText(sock, parsed, `Usage: ${config.prefix}note <text>`); return true; }
        store.addNote(parsed.senderId, parsed.args, config.maxNotes);
        await sendText(sock, parsed, 'Note saved securely in the local state store.');
        return true;
      case 'notes': {
        const notes = store.getNotes(parsed.senderId);
        if (!notes.length) { await sendText(sock, parsed, 'No notes saved.'); return true; }
        await sendText(sock, parsed, notes.map((note, index) => `${index + 1}. ${note.text}`).join('\n'));
        return true;
      }
      case 'clear':
        store.clearConversation(parsed.chatId);
        await sendText(sock, parsed, 'Conversation context cleared for this chat.');
        return true;
      case 'mode': {
        const mode = parsed.args.toLowerCase();
        if (!['public', 'private'].includes(mode)) { await sendText(sock, parsed, `Usage: ${config.prefix}mode public|private`); return true; }
        store.setMode(mode);
        await sendText(sock, parsed, `Bot mode set to ${mode}.`);
        return true;
      }
      case 'diagnostics':
        await sendText(sock, parsed, `*Diagnostics*\nNode: ${process.version}\nPlatform: ${process.platform}/${process.arch}\nMemory RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\nCPUs: ${os.cpus().length}\nState: ${store.filePath}\nPID: ${process.pid}`);
        return true;
      case 'ai':
      case 'ask':
      case 'chat':
        return askAi(sock, parsed, parsed.args);
      default:
        return false;
    }
  }

  async function handleMessage(sock, messageUpdate) {
    const message = messageUpdate?.messages?.[0];
    if (!message?.message || messageUpdate.type !== 'notify') return false;
    const parsed = parseMessage(message, { ...config, botJid: sock.user?.id || config.botJid });
    if (!parsed.chatId || parsed.chatId === 'status@broadcast') return false;
    const messageId = message.key?.id;
    if (messageId && !store.claimMessage(messageId, config.processedMessageTtlMs)) {
      logger.debug('duplicate_message_ignored', { messageId });
      return true;
    }
    if (parsed.isCommand) return handleCommand(sock, parsed);
    if (!parsed.text) return false;
    if (canUseAi(parsed, config)) return askAi(sock, parsed, parsed.text);
    return false;
  }

  return Object.freeze({ handleMessage, handleCommand, askAi, helpText: () => helpText(config) });
}

module.exports = { createAssistant, CORE_COMMANDS, OWNER_COMMANDS, splitText, helpText };
