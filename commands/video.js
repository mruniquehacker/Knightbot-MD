const yts = require('yt-search');
const settings = require('../settings');
const APIs = require('../lib/api');
const { fetchWhatsAppVideo } = require('../lib/waVideo');

function isYouTubeUrl(text) {
  return /youtube\.com|youtu\.be/i.test(text);
}

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : String(text || '').trim();
}

function formatInfo(video) {
  const views = Number(video.views || 0).toLocaleString('en-US');
  return `🎬 *${video.title}*\n⏱ Duration: ${video.timestamp || '—'}\n👀 Views: ${views}`;
}

async function resolveVideo(videoUrl) {
  const steps = [
    ['Knight', () => APIs.knightVideoDownload(videoUrl)],
    ['Prince', () => APIs.princeVideoDownload(videoUrl)],
    ['Hector', () => APIs.hectorVideoDownload(videoUrl)],
    ['EliteProTech', () => APIs.getEliteProTechVideoByUrl(videoUrl)],
    ['Yupra', () => APIs.getYupraVideoByUrl(videoUrl)],
    ['Okatsu', () => APIs.getOkatsuVideoByUrl(videoUrl)],
  ];

  let lastError;
  for (const [name, run] of steps) {
    try {
      const result = await run();
      const download = result.download || result.dl_url || result.dl;
      if (!download || !/^https?:\/\//i.test(download)) throw new Error('No download URL');
      console.log(`[video] OK via ${name}`);
      return { title: result.title || 'Video', download, sourceUrl: result.sourceUrl || videoUrl };
    } catch (err) {
      lastError = err;
      console.log(`[video] ${name} failed:`, err?.message || err);
    }
  }
  throw lastError || new Error('All download sources failed');
}

async function videoCommand(sock, chatId, message) {
  try {
    const text =
      message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.replace(/^\.(?:video|ytmp4|ytv|ytvid)\s*/i, '').trim();

    if (!query) {
      return sock.sendMessage(
        chatId,
        { text: 'Usage: `.video <name or YouTube URL>`' },
        { quoted: message }
      );
    }

    let preview;
    let videoUrl;

    if (isYouTubeUrl(query)) {
      videoUrl = extractUrl(query);
      const ytId = (videoUrl.match(/(?:youtu\.be\/|v=|shorts\/)([a-zA-Z0-9_-]{11})/) || [])[1];
      preview = {
        title: 'YouTube Video',
        thumbnail: ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null,
      };
    } else {
      const search = await yts(query);
      preview = search?.videos?.[0];
      if (!preview) {
        return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
      }
      videoUrl = preview.url;
    }

    if (preview.thumbnail) {
      try {
        await sock.sendMessage(
          chatId,
          {
            image: { url: preview.thumbnail },
            caption: `${formatInfo(preview)}\n\nDownloading...`,
          },
          { quoted: message }
        );
      } catch {
        await sock.sendMessage(
          chatId,
          { text: `${formatInfo(preview)}\n\nDownloading...` },
          { quoted: message }
        );
      }
    }

    const dl = await resolveVideo(videoUrl);
    const video = await fetchWhatsAppVideo(dl.download);
    const botName = settings.botName || 'Knight Bot';
    const title = dl.title || preview.title || 'Video';
    const fileName = `${title.replace(/[^\w\s-]/g, '').trim() || 'video'}.mp4`;

    await sock.sendMessage(
      chatId,
      {
        video,
        mimetype: 'video/mp4',
        fileName,
        caption: `*${title}*\n\n> *_Downloaded by ${botName}_*`,
      },
      { quoted: message }
    );
  } catch (err) {
    console.error('[video]', err?.message || err);
    await sock.sendMessage(
      chatId,
      { text: `❌ Download failed: ${err?.message || 'Unknown error'}` },
      { quoted: message }
    );
  }
}

module.exports = videoCommand;
