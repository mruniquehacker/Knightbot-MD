'use strict';

function unwrapMessage(message) {
  let current = message?.message || message || {};
  for (let i = 0; i < 5; i += 1) {
    if (current?.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    else if (current?.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    else if (current?.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    else break;
  }
  return current || {};
}

function getText(message) {
  const content = unwrapMessage(message);
  return String(
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ''
  ).trim();
}

function getContextInfo(message) {
  const content = unwrapMessage(message);
  return content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    {};
}

function parseMessage(message, config) {
  const chatId = message?.key?.remoteJid || '';
  const senderId = message?.key?.participant || chatId;
  const text = getText(message);
  const isGroup = chatId.endsWith('@g.us');
  const contextInfo = getContextInfo(message);
  const normalizeUserJid = (jid) => {
    const value = String(jid || '');
    const user = value.split('@')[0].split(':')[0];
    const server = value.includes('@') ? value.slice(value.indexOf('@') + 1) : '';
    return `${user}${server ? `@${server}` : ''}`;
  };
  const botId = normalizeUserJid(config?.botJid || '');
  const mentionedJids = contextInfo.mentionedJid || [];
  const isReplyToBot = Boolean(botId && normalizeUserJid(contextInfo.participant) === botId);
  const isMentioned = Boolean(botId && mentionedJids.some((jid) => normalizeUserJid(jid) === botId));
  const prefixes = [config?.prefix || '.', ...(config?.alternatePrefixes || [])];
  const prefix = prefixes.find((candidate) => text.startsWith(candidate));

  if (!prefix) {
    return { chatId, senderId, text, normalizedText: text, isGroup, isCommand: false, command: '', args: '', mentionedJids, isMentioned, isReplyToBot, message };
  }

  const body = text.slice(prefix.length).trim();
  const match = body.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const command = (match?.[1] || '').toLowerCase();
  const args = (match?.[2] || '').trim();
  return {
    chatId,
    senderId,
    text,
    normalizedText: text,
    isGroup,
    isCommand: Boolean(command),
    prefix,
    command,
    args,
    mentionedJids,
    isMentioned,
    isReplyToBot,
    message,
  };
}

module.exports = { unwrapMessage, getText, getContextInfo, parseMessage };
