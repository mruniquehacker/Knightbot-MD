const axios = require('axios');
const settings = require('../settings');
const APIs = require('../lib/api');

const processedMessages = new Set();

const FB_PATTERNS = [
  /https?:\/\/(?:www\.|m\.)?facebook\.com\//i,
  /https?:\/\/(?:www\.|m\.)?fb\.com\//i,
  /https?:\/\/fb\.watch\//i,
];

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : '';
}

async function hanggtsFacebookDownload(url) {
  const { data } = await axios.get('https://api.hanggts.xyz/download/facebook', {
    params: { url },
    timeout: 30000,
    headers: { Accept: '*/*', 'User-Agent': APIs.UA },
    validateStatus: (s) => s >= 200 && s < 500,
  });

  let download =
    data?.result?.media?.video_hd ||
    data?.result?.media?.video_sd ||
    data?.result?.url ||
    data?.result?.download ||
    data?.result?.video ||
    data?.data?.url ||
    data?.data?.download ||
    data?.url ||
    data?.download ||
    null;

  if (typeof data?.result === 'string' && data.result.startsWith('http')) download = data.result;
  if (!download || !/^https?:\/\//i.test(download)) throw new Error('Hanggts returned no video');

  return {
    title: data?.result?.info?.title || data?.result?.title || data?.title || 'Facebook Video',
    download,
  };
}

async function resolveFacebook(url) {
  try {
    return await APIs.knightFacebookDownload(url);
  } catch (err) {
    console.log('[facebook] Knight failed:', err?.message || err);
  }
  return hanggtsFacebookDownload(url);
}

async function sendVideo(sock, chatId, message, videoUrl, title) {
  const bot = (settings.botName || 'Knight Bot').toUpperCase();
  const caption = title ? `*DOWNLOADED BY ${bot}*\n\n📝 ${title}` : `*DOWNLOADED BY ${bot}*`;

  try {
    await sock.sendMessage(
      chatId,
      { video: { url: videoUrl }, mimetype: 'video/mp4', caption },
      { quoted: message }
    );
  } catch {
    const { data } = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: 100 * 1024 * 1024,
      headers: {
        'User-Agent': APIs.UA,
        Accept: 'video/mp4,video/*,*/*',
        Referer: 'https://www.facebook.com/',
      },
    });
    await sock.sendMessage(
      chatId,
      { video: Buffer.from(data), mimetype: 'video/mp4', caption },
      { quoted: message }
    );
  }
}

async function facebookCommand(sock, chatId, message) {
  try {
    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

    const text =
      message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const url = extractUrl(text);

    if (!url) {
      return sock.sendMessage(
        chatId,
        { text: 'Please provide a Facebook link.\nExample: `.fb https://facebook.com/reel/...`' },
        { quoted: message }
      );
    }
    if (!FB_PATTERNS.some((p) => p.test(url))) {
      return sock.sendMessage(
        chatId,
        { text: 'That is not a valid Facebook link.' },
        { quoted: message }
      );
    }

    await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

    const dl = await resolveFacebook(url);
    if (!dl?.download || !/^https?:\/\//i.test(dl.download)) {
      throw new Error('Invalid download response');
    }

    await sendVideo(sock, chatId, message, dl.download, dl.title);
  } catch (err) {
    console.error('[facebook]', err?.message || err);
    await sock.sendMessage(
      chatId,
      { text: '❌ Failed to download Facebook video. Try another link.' },
      { quoted: message }
    );
  }
}

module.exports = facebookCommand;
