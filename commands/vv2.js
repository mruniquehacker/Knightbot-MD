const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function dmJid(message, senderId) {
  let jid = senderId || message.key.participant || message.key.remoteJid || '';
  if (String(jid).endsWith('@g.us')) {
    jid = message.key.participant || '';
  }
  return String(jid).replace(/:\d+@/, '@');
}

async function vv2Command(sock, chatId, message, senderId) {
  const fail = (text) => sock.sendMessage(chatId, { text }, { quoted: message });

  try {
    const ctx =
      message.message?.extendedTextMessage?.contextInfo ||
      message.message?.imageMessage?.contextInfo ||
      message.message?.videoMessage?.contextInfo ||
      message.message?.buttonsResponseMessage?.contextInfo ||
      message.message?.listResponseMessage?.contextInfo;

    if (!ctx?.quotedMessage) {
      return fail('🗑️ Reply to a *view-once* message.\nIt will be sent to your DM.');
    }

    const quotedMsg = ctx.quotedMessage;
    const hasViewOnce =
      !!quotedMsg.viewOnceMessageV2 ||
      !!quotedMsg.viewOnceMessageV2Extension ||
      !!quotedMsg.viewOnceMessage ||
      !!quotedMsg.viewOnce ||
      !!quotedMsg?.imageMessage?.viewOnce ||
      !!quotedMsg?.videoMessage?.viewOnce ||
      !!quotedMsg?.audioMessage?.viewOnce;

    if (!hasViewOnce) {
      return fail('❌ This is not a view-once message!');
    }

    let actualMsg = null;
    let mtype = null;

    if (quotedMsg.viewOnceMessageV2Extension?.message) {
      actualMsg = quotedMsg.viewOnceMessageV2Extension.message;
      mtype = Object.keys(actualMsg)[0];
    } else if (quotedMsg.viewOnceMessageV2?.message) {
      actualMsg = quotedMsg.viewOnceMessageV2.message;
      mtype = Object.keys(actualMsg)[0];
    } else if (quotedMsg.viewOnceMessage?.message) {
      actualMsg = quotedMsg.viewOnceMessage.message;
      mtype = Object.keys(actualMsg)[0];
    } else if (quotedMsg.imageMessage?.viewOnce) {
      actualMsg = { imageMessage: quotedMsg.imageMessage };
      mtype = 'imageMessage';
    } else if (quotedMsg.videoMessage?.viewOnce) {
      actualMsg = { videoMessage: quotedMsg.videoMessage };
      mtype = 'videoMessage';
    } else if (quotedMsg.audioMessage?.viewOnce) {
      actualMsg = { audioMessage: quotedMsg.audioMessage };
      mtype = 'audioMessage';
    }

    if (!actualMsg || !mtype) {
      return fail('❌ Unsupported view-once message type.');
    }

    const dest = dmJid(message, senderId);
    if (!dest || dest.endsWith('@g.us') || dest.endsWith('@broadcast')) {
      return fail('❌ Could not find your DM.');
    }

    const downloadType =
      mtype === 'imageMessage' ? 'image' : mtype === 'videoMessage' ? 'video' : 'audio';

    const mediaStream = await downloadContentFromMessage(actualMsg[mtype], downloadType);
    let buffer = Buffer.from([]);
    for await (const chunk of mediaStream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    const caption = actualMsg[mtype]?.caption || '';
    const payload = /video/.test(mtype)
      ? { video: buffer, caption, mimetype: 'video/mp4' }
      : /image/.test(mtype)
        ? { image: buffer, caption, mimetype: 'image/jpeg' }
        : { audio: buffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' };

    await sock.sendMessage(dest, payload);

    if (dest !== chatId) {
      await sock.sendMessage(chatId, { text: '✅ Sent to your DM.' }, { quoted: message });
    }
  } catch (error) {
    console.error('[vv2]', error?.message || error);
    await fail('❌ Error processing view-once message: ' + (error.message || 'Unknown error'));
  }
}

module.exports = vv2Command;
