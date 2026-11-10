/**
 * Antibot — detect other Baileys bots via message-ID heuristics, then warn/kick.
 */

const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');
const { lidToMention, findParticipant, buildComparableIds } = require('../lib/jidHelper');
const { incrementWarningCount, resetWarningCount } = require('../lib/index');

const STATE_FILE = path.join(__dirname, '../data/antibot.json');
const recent = new Map(); // msgId -> ts

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[antibot] save:', e.message);
  }
}

function getConfig(jid) {
  const state = loadState();
  const cfg = state[jid] || {};
  return {
    enabled: cfg.enabled === true,
    action: cfg.action === 'kick' ? 'kick' : 'warn',
  };
}

function setConfig(jid, patch) {
  const state = loadState();
  state[jid] = { ...getConfig(jid), ...patch };
  saveState(state);
  return state[jid];
}

/** Classic Baileys / bot-library message ID fingerprints */
function isBaileysBotId(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.startsWith('BAE5') && id.length === 16) return true;
  if (id.startsWith('3EB0') && (id.length === 12 || id.length === 20 || id.length === 22 || id.length === 40)) {
    return true;
  }
  if (id.startsWith('B24E') && id.length === 20) return true;
  if (id.startsWith('NJX-')) return true;
  // Many forks: PREFIX-hex with a dash
  if (/^[A-Z0-9]{2,8}-[A-F0-9]{8,}$/i.test(id)) return true;
  return false;
}

async function antibotCommand(sock, chatId, message, senderId) {
  const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });

  if (!chatId.endsWith('@g.us')) {
    return reply('👥 This command can only be used in groups.');
  }

  const owner = message.key.fromMe || (await isOwnerOrSudo(senderId, sock, chatId));
  const adminStatus = await isAdmin(sock, chatId, senderId);
  if (!adminStatus.isBotAdmin) {
    return reply('❌ Please make the bot an admin first.');
  }
  if (!owner && !adminStatus.isSenderAdmin) {
    return reply('❌ Only group admins can use this command.');
  }

  const text =
    message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  const args = text.trim().split(/\s+/).slice(1);
  const opt = (args[0] || '').toLowerCase();
  const cfg = getConfig(chatId);

  if (!opt) {
    return reply(
      `🤖 *Antibot Status*\n\n` +
        `Status: *${cfg.enabled ? 'ON' : 'OFF'}*\n` +
        `Action: *${cfg.action}*\n\n` +
        `Admins, owner, and this bot are exempt.\n` +
        `Detects other Baileys bots by message-ID pattern.\n\n` +
        `Usage:\n` +
        `  \`.antibot on\`\n` +
        `  \`.antibot off\`\n` +
        `  \`.antibot set warn | kick\`\n` +
        `  \`.antibot get\``
    );
  }

  if (opt === 'on') {
    if (cfg.enabled) return reply('*Antibot is already on*');
    setConfig(chatId, { enabled: true });
    return reply('*Antibot has been turned ON*');
  }

  if (opt === 'off') {
    setConfig(chatId, { enabled: false });
    return reply('*Antibot has been turned OFF*');
  }

  if (opt === 'set') {
    const setAction = (args[1] || '').toLowerCase();
    if (!['warn', 'kick'].includes(setAction)) {
      return reply('*Invalid action. Choose warn or kick.*\n`.antibot set warn | kick`');
    }
    setConfig(chatId, { enabled: true, action: setAction });
    return reply(`*Antibot action set to ${setAction}*`);
  }

  if (opt === 'get') {
    return reply(
      `*Antibot Configuration:*\nStatus: ${cfg.enabled ? 'ON' : 'OFF'}\nAction: ${cfg.action}`
    );
  }

  return reply('*Use `.antibot` for usage.*');
}

/**
 * Call on inbound group messages (including BAE5 IDs that index.js would otherwise drop).
 */
async function handleAntibotDetection(sock, message) {
  try {
    const chatId = message?.key?.remoteJid;
    if (!chatId?.endsWith('@g.us')) return false;
    if (message.key.fromMe) return false;

    const cfg = getConfig(chatId);
    if (!cfg.enabled) return false;

    const msgId = message.key.id;
    if (!isBaileysBotId(msgId)) return false;

    // Dedupe notify+append / double hooks
    const now = Date.now();
    if (recent.has(msgId) && now - recent.get(msgId) < 20000) return false;
    recent.set(msgId, now);
    if (recent.size > 300) {
      for (const [id, ts] of recent) {
        if (now - ts > 60000) recent.delete(id);
      }
    }

    const senderRaw = message.key.participant || message.participant || message.key.remoteJid;
    const mention = lidToMention([
      message.key.participantAlt,
      senderRaw,
      message.key.participant,
    ]);
    const targetJid = mention.jid || senderRaw;

    // Exempt this bot / owner / group admins
    const adminStatus = await isAdmin(sock, chatId, targetJid);
    if (!adminStatus.isBotAdmin) return false;
    if (adminStatus.isSenderAdmin) return false;

    const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean);
    const targetIds = new Set(buildComparableIds(targetJid));
    if (botIds.some((b) => buildComparableIds(b).some((id) => targetIds.has(id)))) {
      return false;
    }

    // Prefer kick JID that exists in group metadata
    let kickJid = targetJid;
    try {
      const meta = await sock.groupMetadata(chatId);
      const found = findParticipant(meta.participants, [
        targetJid,
        senderRaw,
        message.key.participantAlt,
        message.key.participant,
      ]);
      if (found?.id) kickJid = found.id;
      else if (found?.phoneNumber) kickJid = found.phoneNumber;
    } catch {}

    const tag = mention.number || kickJid.split('@')[0];
    const mentions = mention.mentions.length ? mention.mentions : [kickJid];

    // Delete the bot message first
    try {
      await sock.sendMessage(chatId, { delete: message.key });
    } catch {}

    if (cfg.action === 'kick') {
      try {
        await sock.groupParticipantsUpdate(chatId, [kickJid], 'remove');
        await sock.sendMessage(chatId, {
          text: `🤖 *@${tag}* was kicked — other bots are not allowed here.`,
          mentions,
        });
      } catch (e) {
        console.error('[antibot] kick:', e?.message || e);
        await sock.sendMessage(chatId, {
          text: `🤖 Bot activity detected from *@${tag}* (kick failed — check bot admin rights).`,
          mentions,
        });
      }
      return true;
    }

    // warn (default)
    const warningCount = await incrementWarningCount(chatId, kickJid);
    if (warningCount >= 3) {
      try {
        await sock.groupParticipantsUpdate(chatId, [kickJid], 'remove');
        await resetWarningCount(chatId, kickJid);
        await sock.sendMessage(chatId, {
          text: `🤖 *@${tag}* kicked after 3 antibot warnings.`,
          mentions,
        });
      } catch (e) {
        console.error('[antibot] warn-kick:', e?.message || e);
      }
    } else {
      await sock.sendMessage(chatId, {
        text: `🤖 *@${tag}* warning ${warningCount}/3 — other bots are not allowed.`,
        mentions,
      });
    }
    return true;
  } catch (e) {
    console.error('[antibot]', e?.message || e);
    return false;
  }
}

module.exports = antibotCommand;
module.exports.handleAntibotDetection = handleAntibotDetection;
module.exports.isBaileysBotId = isBaileysBotId;
module.exports.getConfig = getConfig;
