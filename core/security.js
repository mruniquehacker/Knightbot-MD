'use strict';

function bareJid(jid) {
  const value = String(jid || '').trim();
  const userPart = value.split('@')[0];
  const serverPart = value.includes('@') ? value.slice(value.indexOf('@') + 1) : '';
  return `${userPart.split(':')[0]}${serverPart ? `@${serverPart}` : ''}`;
}

function jidForNumber(number) {
  const digits = String(number || '').replace(/[^0-9]/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function isOwner(senderId, config) {
  const configured = jidForNumber(config?.ownerNumber);
  if (!configured) return false;
  return bareJid(senderId) === bareJid(configured);
}

function canUseBot(parsed, config, mode) {
  if (!parsed?.senderId) return false;
  if (mode === 'private' && !isOwner(parsed.senderId, config)) return false;
  if (parsed.message?.key?.fromMe && !config.allowFromMe) return false;
  return true;
}

function canUseAi(parsed, config) {
  if (!canUseBot(parsed, config, config.commandMode)) return false;
  if (parsed.isGroup) return Boolean(config.groupAi && (parsed.isMentioned || parsed.isReplyToBot));
  return Boolean(config.directAi);
}

module.exports = { bareJid, jidForNumber, isOwner, canUseBot, canUseAi };
