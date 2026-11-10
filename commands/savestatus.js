/**
 * savestatus — owner only.
 * Reply to a status to save it, or turn on auto-save (rate-limited).
 * Single file: helpers + command. Designed to avoid WhatsApp flood / bans.
 */

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');
const { lidToMention } = require('../lib/jidHelper');

const STATE_FILE = path.join(__dirname, '../data/savestatus.json');
const TIMEOUT_MS = 25000;
const RECENT_MAX = 80;
const RECENT_MS = 24 * 60 * 60 * 1000;
const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15MB — skip huge statuses
const MIN_SAVE_GAP_MS = 12000; // min 12s between any saves
const MAX_AUTO_PER_HOUR = 20;
const AUTO_DELAY_MS = 2500; // wait before auto-save send

const recent = new Map();
const savedIds = new Set(); // dedupe status message ids
const autoHourly = [];
let enabled = false;
let saveQueue = Promise.resolve();
let lastSaveAt = 0;
let saving = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8') || '{}');
    enabled = data.enabled === true;
  } catch {
    enabled = false;
  }
}

function isEnabled() {
  return enabled;
}

function setEnabled(value) {
  enabled = value === true;
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ enabled }, null, 2));
  } catch (error) {
    console.error('[savestatus] save failed:', error.message);
  }
  return enabled;
}

loadState();

function ownerJid(sock) {
  const raw = settings.ownerNumber || sock?.user?.id || '';
  const num = String(raw).split(':')[0].split('@')[0].replace(/\D/g, '');
  return num.length >= 8 ? `${num}@s.whatsapp.net` : null;
}

function unwrap(message) {
  let current = message;
  for (let i = 0; i < 5 && current; i++) {
    const next =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.viewOnceMessageV2Extension?.message;
    if (!next) break;
    current = next;
  }
  return current || null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > MAX_MEDIA_BYTES) throw new Error('Status media too large (skipped)');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function downloadMediaRaw(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  return streamToBuffer(stream);
}

function isValidMediaBuffer(buf, type) {
  if (!buf || buf.length < 64) return false;
  if (type === 'image') {
    // jpeg / png / webp
    if (buf[0] === 0xff && buf[1] === 0xd8) return true;
    if (buf[0] === 0x89 && buf[1] === 0x50) return true;
    if (buf.slice(0, 4).toString() === 'RIFF') return true;
    return buf.length > 500;
  }
  if (type === 'video') {
    return buf.slice(4, 8).toString('ascii') === 'ftyp' || buf.length > 2000;
  }
  // audio / other
  return buf.length > 200;
}

/** Open status + wait so media keys exist (first-open needs longer) */
async function prefetchStatus(sock, statusKey, waitMs = 2000) {
  if (!sock || !statusKey?.id) return;
  const key = {
    remoteJid: 'status@broadcast',
    id: statusKey.id,
    participant: statusKey.participant || statusKey.participantAlt,
    fromMe: false,
  };
  try {
    await sock.readMessages([key]);
  } catch (e) {
    console.log('[savestatus] readMessages:', e?.message || e);
  }
  await sleep(waitMs);
}

/**
 * Prefer downloadMediaMessage + updateMediaMessage (retries media keys).
 * Falls back to downloadContentFromMessage with retries.
 * Rejects tiny/invalid buffers so we never send a "Waiting for this message…" stub.
 */
async function fetchStatusMedia(sock, fullMsg, mediaMsg, type) {
  let lastError;
  const mediaNode = mediaMsg || fullMsg?.message?.imageMessage || fullMsg?.message?.videoMessage || fullMsg?.message?.audioMessage;

  // Refresh keys up front when possible
  if (fullMsg?.key && sock?.updateMediaMessage) {
    try {
      await sock.updateMediaMessage(fullMsg);
      await sleep(500);
    } catch {}
  }

  // 1) Full message download with media refresh
  if (fullMsg?.key && fullMsg?.message && sock?.updateMediaMessage) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        if (attempt > 1) {
          try {
            await sock.updateMediaMessage(fullMsg);
          } catch {}
          await sleep(1000 * attempt);
        }
        const buf = await downloadMediaMessage(
          fullMsg,
          'buffer',
          {},
          { logger: undefined, reuploadRequest: sock.updateMediaMessage }
        );
        const out = Buffer.from(buf || []);
        if (out.length > MAX_MEDIA_BYTES) throw new Error('Status media too large (skipped)');
        if (isValidMediaBuffer(out, type)) return out;
        lastError = new Error(`Invalid ${type} buffer (${out.length}b)`);
      } catch (err) {
        lastError = err;
        console.log(`[savestatus] media attempt ${attempt}/4:`, err?.message || err);
      }
    }
  }

  // 2) Direct content stream with retries
  if (mediaNode) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        if (attempt > 1) await sleep(900 * attempt);
        const buf = await downloadMediaRaw(mediaNode, type);
        if (isValidMediaBuffer(buf, type)) return buf;
        lastError = new Error(`Invalid ${type} buffer (${buf?.length || 0}b)`);
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Failed to download status media');
}

function statusHeader(candidates) {
  // participantAlt (phone) first, then participant (may be @lid)
  const who = lidToMention(candidates);
  if (!who.jid) return { text: '💾 *Saved Status*', mentions: [] };
  if (who.number) {
    return { text: `💾 *Saved Status* from ${who.text}`, mentions: who.mentions };
  }
  // LID not mapped yet — still mention, but don't show raw lid as "+number"
  return { text: `💾 *Saved Status* from ${who.text}`, mentions: who.mentions };
}

function remember(msg) {
  if (!msg?.key?.id || msg.key.fromMe) return;
  if (msg.key.remoteJid !== 'status@broadcast') return;
  recent.set(msg.key.id, { msg, at: Date.now() });
  while (recent.size > RECENT_MAX) {
    recent.delete(recent.keys().next().value);
  }
}

function findRecent(id) {
  if (!id) return null;
  const hit = recent.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > RECENT_MS) {
    recent.delete(id);
    return null;
  }
  return hit.msg;
}

function contextOf(msg) {
  const raw = unwrap(msg?.message) || msg?.message || {};
  return (
    raw.extendedTextMessage?.contextInfo ||
    raw.imageMessage?.contextInfo ||
    raw.videoMessage?.contextInfo ||
    raw.audioMessage?.contextInfo ||
    raw.stickerMessage?.contextInfo ||
    null
  );
}

function pruneHourly() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (autoHourly.length && autoHourly[0] < cutoff) autoHourly.shift();
}

function canAutoSave() {
  pruneHourly();
  return autoHourly.length < MAX_AUTO_PER_HOUR;
}

async function waitGap() {
  const wait = MIN_SAVE_GAP_MS - (Date.now() - lastSaveAt);
  if (wait > 0) await sleep(wait);
}

async function saveStatusContent(sock, destJid, content, header, mentions = [], statusKey = null, opts = {}) {
  const quoted = unwrap(content);
  if (!quoted) throw new Error('Empty status');
  const mention = mentions.filter(Boolean);
  const withMentions = (payload) => (mention.length ? { ...payload, mentions: mention } : payload);
  const isManual = opts.manual === true;

  // Rate gap only for auto-save — manual should be immediate
  if (!isManual) await waitGap();
  if (saving) throw new Error('Another save is in progress — try again in a moment');
  saving = true;
  try {
    // First open needs a real view + longer wait or WhatsApp sends a stub ("Waiting for this message…")
    if (statusKey?.id) await prefetchStatus(sock, statusKey, isManual ? 2200 : 1800);

    const fullMsg =
      statusKey?.id
        ? {
            key: {
              remoteJid: 'status@broadcast',
              id: statusKey.id,
              participant: statusKey.participant || statusKey.participantAlt,
              fromMe: false,
            },
            message: quoted,
          }
        : null;

    if (quoted.imageMessage) {
      const buf = await fetchStatusMedia(sock, fullMsg, quoted.imageMessage, 'image');
      const caption = quoted.imageMessage.caption || '';
      await sock.sendMessage(
        destJid,
        withMentions({
          image: buf,
          caption: caption ? `${header}\n\n${caption}` : header,
        })
      );
      lastSaveAt = Date.now();
      return 'image';
    }
    if (quoted.videoMessage) {
      const buf = await fetchStatusMedia(sock, fullMsg, quoted.videoMessage, 'video');
      const caption = quoted.videoMessage.caption || '';
      await sock.sendMessage(
        destJid,
        withMentions({
          video: buf,
          caption: caption ? `${header}\n\n${caption}` : header,
          mimetype: 'video/mp4',
        })
      );
      lastSaveAt = Date.now();
      return 'video';
    }
    if (quoted.audioMessage) {
      const buf = await fetchStatusMedia(sock, fullMsg, quoted.audioMessage, 'audio');
      await sock.sendMessage(destJid, withMentions({ text: header }));
      await sleep(800);
      await sock.sendMessage(destJid, {
        audio: buf,
        mimetype: quoted.audioMessage.mimetype || 'audio/ogg; codecs=opus',
        ptt: !!quoted.audioMessage.ptt,
      });
      lastSaveAt = Date.now();
      return 'audio';
    }
    const text = quoted.conversation || quoted.extendedTextMessage?.text;
    if (text) {
      await sock.sendMessage(destJid, withMentions({ text: `${header}\n\n${text}` }));
      lastSaveAt = Date.now();
      return 'text';
    }
    throw new Error('Unsupported status type');
  } finally {
    saving = false;
  }
}

/** Serialize auto-saves; errors logged (manual path awaits directly) */
function enqueueSave(fn) {
  saveQueue = saveQueue.then(fn).catch((err) => {
    console.error('[savestatus] queue:', err?.message || err);
  });
  return saveQueue;
}

function hasMediaContent(msg) {
  const m = unwrap(msg);
  return !!(
    m?.imageMessage ||
    m?.videoMessage ||
    m?.audioMessage ||
    m?.conversation ||
    m?.extendedTextMessage
  );
}

async function autoSave(sock, msg) {
  // Only real status messages — ignore reaction / empty updates
  if (!msg?.key?.id || !msg.message) return;
  if (msg.key.remoteJid !== 'status@broadcast') return;
  if (msg.key.fromMe) return;

  remember(msg);
  if (!enabled) return;

  if (savedIds.has(msg.key.id)) return;
  if (!canAutoSave()) {
    console.log('[savestatus] hourly limit reached — skipping auto-save');
    return;
  }

  const age = msg.messageTimestamp ? Date.now() - Number(msg.messageTimestamp) * 1000 : 0;
  if (age > 5 * 60 * 1000) return; // only fresh statuses

  const dest = ownerJid(sock);
  if (!dest) return;

  savedIds.add(msg.key.id);
  if (savedIds.size > 200) {
    const first = savedIds.values().next().value;
    savedIds.delete(first);
  }

  enqueueSave(async () => {
    await sleep(AUTO_DELAY_MS);
    const header = statusHeader([
      msg.key.participantAlt,
      msg.key.participant,
      msg.key.remoteJidAlt,
    ]);
    try {
      await saveStatusContent(sock, dest, msg.message, header.text, header.mentions, msg.key);
      autoHourly.push(Date.now());
    } catch (error) {
      savedIds.delete(msg.key.id); // allow retry later
      if (error.message === 'Unsupported status type' || error.message === 'Empty status') return;
      if (/too large/i.test(error.message)) return;
      console.error('[savestatus] auto:', error.message);
    }
  });
}

async function savestatusCommand(sock, chatId, message, senderId) {
  const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });

  try {
    const isOwner = message.key.fromMe || (await isOwnerOrSudo(senderId, sock, chatId));
    if (!isOwner) {
      return reply('❌ This command can only be used by the owner!');
    }

    const text =
      message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const args = text.trim().split(/\s+/).slice(1);
    const sub = (args[0] || '').toLowerCase();

    if (['on', 'off', 'enable', 'disable'].includes(sub)) {
      const enable = sub === 'on' || sub === 'enable';
      if (enable === isEnabled()) {
        return reply(`💾 Auto-save is already *${enable ? 'ON' : 'OFF'}*.`);
      }
      setEnabled(enable);
      return reply(
        enable
          ? '💾 *Auto-save ON* (safe mode).\n• Max 20/hour\n• 12s gap between saves\n• Large media skipped\n\nEvery new status will be forwarded slowly to your chat.'
          : '💾 *Auto-save OFF.*'
      );
    }

    const ctx = contextOf(message);
    const quoted = unwrap(ctx?.quotedMessage);
    const stanzaId = ctx?.stanzaId;
    let cached = findRecent(stanzaId);

    // Prefetch ASAP so first-time status media keys load before we download
    const statusKey = {
      id: stanzaId || cached?.key?.id,
      participant: ctx?.participant || cached?.key?.participant,
      participantAlt: ctx?.participantAlt || cached?.key?.participantAlt,
    };
    if (statusKey.id) {
      await reply('⏳ Fetching status media…');
      await prefetchStatus(sock, statusKey, 2500);
      // Re-check cache after view (upsert may have filled full message)
      cached = findRecent(stanzaId) || cached;
    }

    // Prefer FULL cached status message over quoted stub (quoted is often incomplete first time)
    const content = hasMediaContent(cached?.message)
      ? cached.message
      : hasMediaContent(quoted)
        ? quoted
        : null;

    if (content) {
      const dest = ownerJid(sock);
      if (!dest) return reply('❌ Owner number is not set in settings.js.');
      const header = statusHeader([
        ctx?.participantAlt,
        cached?.key?.participantAlt,
        ctx?.participant,
        cached?.key?.participant,
      ]);
      try {
        // Manual: await directly so errors aren't swallowed by the auto-save queue
        await saveStatusContent(sock, dest, content, header.text, header.mentions, statusKey, {
          manual: true,
        });
        if (chatId !== dest) await reply('✅ Status saved to your chat.');
        else await reply('✅ Status saved.');
      } catch (error) {
        console.error('[savestatus]', error.message);
        return reply(`❌ Could not save that status. ${error.message}`);
      }
      return;
    }

    if (!args[0] || sub === 'status') {
      const on = isEnabled();
      return reply(
        `💾 *Save status*\n\n` +
          `Auto-save: *${on ? 'ON' : 'OFF'}*\n\n` +
          `Reply to a status → \`.savestatus\`\n` +
          `\`.savestatus on\` — slow auto-save (rate-limited)\n` +
          `\`.savestatus off\` — stop\n\n` +
          `_Tip: keep only one bot instance running to avoid WhatsApp conflicts._`
      );
    }

    return reply('Reply to a status, then send `.savestatus`.');
  } catch (err) {
    console.error('[savestatus]', err?.message || err);
    await reply('❌ Error: ' + (err.message || 'Unknown'));
  }
}

module.exports = savestatusCommand;
module.exports.autoSave = autoSave;
module.exports.isEnabled = isEnabled;
module.exports.setEnabled = setEnabled;
