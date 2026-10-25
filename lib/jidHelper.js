/**
 * JID Helper Utilities for LID-aware matching
 */

const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const lidMappingCache = new Map();

const getLidMappingValue = (user, direction) => {
  if (!user) return null;
  const cacheKey = `${direction}:${user}`;
  if (lidMappingCache.has(cacheKey)) {
    return lidMappingCache.get(cacheKey);
  }

  const sessionPath = path.join(__dirname, '..', 'session');
  const suffix = direction === 'pnToLid' ? '.json' : '_reverse.json';
  const filePath = path.join(sessionPath, `lid-mapping-${user}${suffix}`);

  if (!fs.existsSync(filePath)) {
    lidMappingCache.set(cacheKey, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const value = raw ? JSON.parse(raw) : null;
    lidMappingCache.set(cacheKey, value || null);
    return value || null;
  } catch {
    lidMappingCache.set(cacheKey, null);
    return null;
  }
};

const normalizeJidWithLid = (jid) => {
  if (!jid) return jid;

  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return `${jid.split(':')[0].split('@')[0]}@s.whatsapp.net`;
    }

    let user = decoded.user;
    let server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;

    const mapToPn = () => {
      const pnUser = getLidMappingValue(user, 'lidToPn');
      if (pnUser) {
        user = pnUser;
        server = server === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
        return true;
      }
      return false;
    };

    if (server === 'lid' || server === 'hosted.lid') {
      mapToPn();
    } else if (server === 's.whatsapp.net' || server === 'hosted') {
      mapToPn();
    }

    if (server === 'hosted') {
      return jidEncode(user, 'hosted');
    }
    return jidEncode(user, 's.whatsapp.net');
  } catch {
    return jid;
  }
};

const buildComparableIds = (jid) => {
  if (!jid) return [];

  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return [normalizeJidWithLid(jid)].filter(Boolean);
    }

    const variants = new Set();
    const normalizedServer = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;

    variants.add(jidEncode(decoded.user, normalizedServer));

    const isPnServer = normalizedServer === 's.whatsapp.net' || normalizedServer === 'hosted';
    const isLidServer = normalizedServer === 'lid' || normalizedServer === 'hosted.lid';

    if (isPnServer) {
      const lidUser = getLidMappingValue(decoded.user, 'pnToLid');
      if (lidUser) {
        const lidServer = normalizedServer === 'hosted' ? 'hosted.lid' : 'lid';
        variants.add(jidEncode(lidUser, lidServer));
      }
    } else if (isLidServer) {
      const pnUser = getLidMappingValue(decoded.user, 'lidToPn');
      if (pnUser) {
        const pnServer = normalizedServer === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
        variants.add(jidEncode(pnUser, pnServer));
      }
    }

    return Array.from(variants);
  } catch {
    return [jid];
  }
};

const findParticipant = (participants = [], userIds) => {
  const targets = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .flatMap((id) => buildComparableIds(id));

  if (!targets.length) return null;

  return (
    participants.find((participant) => {
      if (!participant) return false;
      const participantIds = [participant.id, participant.lid, participant.userJid]
        .filter(Boolean)
        .flatMap((id) => buildComparableIds(id));
      return participantIds.some((id) => targets.includes(id));
    }) || null
  );
};

function digitsOf(value) {
  const num = String(value || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
  if (num.length < 8 || num.length > 15) return null;
  return num;
}

function phoneJidFromLid(user, server) {
  const pn = digitsOf(getLidMappingValue(user, 'lidToPn'));
  if (!pn) return null;
  const pnServer = server === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
  return jidEncode(pn, pnServer);
}

/**
 * LID / phone JID → mention payload for sendMessage.
 * Prefer participantAlt (phone) over participant (lid).
 */
function lidToMention(candidates) {
  const list = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
  let lidFallback = null;

  for (const jid of list) {
    const raw = String(jid);
    let decoded = null;
    try {
      decoded = jidDecode(raw);
    } catch {
      decoded = null;
    }

    const bareUser = String(decoded?.user || raw.split('@')[0]).split(':')[0];
    const server = decoded?.server === 'c.us' ? 's.whatsapp.net' : decoded?.server;
    const isLid =
      server === 'lid' ||
      server === 'hosted.lid' ||
      raw.includes('@lid') ||
      raw.includes('hosted.lid');

    if (isLid) {
      const phoneJid = phoneJidFromLid(bareUser.replace(/\D/g, '') || bareUser, server || 'lid');
      if (phoneJid) {
        const number = phoneJid.split('@')[0];
        return { jid: phoneJid, number, isLid: false, text: `@${number}`, mentions: [phoneJid] };
      }
      if (!lidFallback) {
        lidFallback = raw.includes('@') ? raw.split(':')[0] : `${bareUser}@lid`;
      }
      continue;
    }

    if (
      server === 's.whatsapp.net' ||
      server === 'hosted' ||
      raw.endsWith('@s.whatsapp.net') ||
      raw.endsWith('@c.us')
    ) {
      const number = digitsOf(bareUser);
      if (!number) continue;
      const phoneJid = jidEncode(number, server === 'hosted' ? 'hosted' : 's.whatsapp.net');
      return { jid: phoneJid, number, isLid: false, text: `@${number}`, mentions: [phoneJid] };
    }
  }

  if (lidFallback) {
    return {
      jid: lidFallback,
      number: null,
      isLid: true,
      text: `@${lidFallback.split('@')[0]}`,
      mentions: [lidFallback],
    };
  }
  return { jid: null, number: null, isLid: false, text: '', mentions: [] };
}

function lidToNumber(jid) {
  const mention = lidToMention(jid);
  return mention.isLid ? null : mention.number;
}

module.exports = {
  findParticipant,
  buildComparableIds,
  normalizeJidWithLid,
  getLidMappingValue,
  lidToMention,
  lidToNumber,
};
