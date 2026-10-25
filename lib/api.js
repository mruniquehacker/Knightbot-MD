const axios = require('axios');
const settings = require('../settings');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const AXIOS_DEFAULTS = {
  timeout: 60000,
  headers: {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
  },
};

const api = axios.create({
  timeout: 30000,
  headers: { 'User-Agent': UA },
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryRequest(getter, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getter();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

function pickUrl(result) {
  const url = result?.download || result?.dl_url || result?.dl || result?.downloadUrl || result?.downloadURL;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function isIpLockedCdn(url) {
  return /googlevideo\.com|youtube\.com\/videoplayback/i.test(String(url || ''));
}

function knightBase() {
  return String(settings.knightApiUrl || settings.mediaApiUrl || 'https://knightbotapi.stream').replace(/\/$/, '');
}

function knightKey() {
  return settings.knightApiKey || settings.mediaApiKey || 'knight';
}

function princeBase() {
  return String(settings.princeApiUrl || 'https://api.princetechn.com').replace(/\/$/, '');
}

function princeKey() {
  return settings.princeApiKey || 'prince';
}

function toYouTubeWatchUrl(input) {
  const text = String(input || '').trim();
  const m = text.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i)
    || text.match(/^([a-zA-Z0-9_-]{11})$/);
  return m?.[1] ? `https://youtu.be/${m[1]}` : text;
}

async function knightSongDownload(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { data, status } = await axios.get(`${knightBase()}/api/download/ytaudio`, {
        params: { apikey: knightKey(), format: '128kbps', url },
        timeout: 180000,
        validateStatus: () => true,
        headers: { Accept: 'application/json', 'User-Agent': UA },
      });
      if (status >= 500 || !data?.success) {
        throw new Error(data?.result?.error || data?.error || data?.message || `Knight API HTTP ${status}`);
      }
      const result = data.result || data;
      const download = pickUrl(result);
      if (!download) throw new Error('Knight API returned no download URL');
      return { download, title: result?.title, thumbnail: result?.thumbnail || null };
    } catch (err) {
      lastError = err;
      console.log(`[song] Knight attempt ${attempt}/${attempts}:`, err.message);
      if (attempt < attempts) await sleep(1500 * attempt);
    }
  }
  throw lastError || new Error('Knight API failed');
}

async function hectorSongDownload(url, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { data, status } = await axios.get('https://yt-dl.officialhectormanuel.workers.dev', {
        params: { url },
        timeout: 90000,
        validateStatus: () => true,
        headers: { Accept: 'application/json', 'User-Agent': UA },
      });
      if (status >= 400 || data?.status === false) {
        throw new Error(data?.message || data?.error || `Hector API HTTP ${status}`);
      }
      if (!data?.audio || !/^https?:\/\//i.test(data.audio)) {
        throw new Error('Hector API returned no audio URL');
      }
      return { download: data.audio, title: data?.title, thumbnail: data?.thumbnail || null };
    } catch (err) {
      lastError = err;
      console.log(`[song] Hector attempt ${attempt}/${attempts}:`, err.message);
      if (attempt < attempts) await sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Hector API failed');
}

async function princeSongDownload(url, attempts = 2) {
  const watchUrl = toYouTubeWatchUrl(url);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const endpoint = new URL('/api/download/ytmp3', princeBase());
      endpoint.searchParams.set('apikey', princeKey());
      endpoint.searchParams.set('url', watchUrl);
      const { data, status } = await axios.get(endpoint.toString(), {
        timeout: 120000,
        validateStatus: () => true,
        headers: { Accept: 'application/json', 'User-Agent': UA },
      });
      if (status >= 400 || data?.success === false) {
        throw new Error(data?.message || data?.error || `Prince API HTTP ${status}`);
      }
      const result = data?.result || data;
      const download = result?.downloadUrl || pickUrl(result);
      if (!download) throw new Error('Prince API returned no download URL');
      return { download, title: result?.title, thumbnail: result?.thumbnail || null };
    } catch (err) {
      lastError = err;
      console.log(`[song] Prince attempt ${attempt}/${attempts}:`, err.message);
      if (attempt < attempts) await sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Prince API failed');
}

async function prexzySongDownload(url) {
  const { data } = await axios.get('https://prexzyapis.com/download/ytmp3', {
    params: { url },
    timeout: 90000,
    headers: AXIOS_DEFAULTS.headers,
  });
  if (!data?.status || !data?.download_url) {
    throw new Error(data?.message || data?.error || 'Prexzy ytmp3 returned no download_url');
  }
  if (isIpLockedCdn(data.download_url)) {
    throw new Error('Prexzy returned IP-locked googlevideo URL');
  }
  return {
    download: data.download_url,
    title: data.info?.title || null,
    thumbnail: data.info?.thumbnail || null,
    referer: 'https://www.youtube.com/',
  };
}

async function getEliteProTechDownloadByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.success && res?.data?.downloadURL) {
    return { download: res.data.downloadURL, title: res.data.title };
  }
  throw new Error('EliteProTech ytdown returned no download');
}

async function getYupraDownloadByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.success && res?.data?.data?.download_url) {
    return {
      download: res.data.data.download_url,
      title: res.data.data.title,
      thumbnail: res.data.data.thumbnail,
    };
  }
  throw new Error('Yupra returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.dl) {
    return { download: res.data.dl, title: res.data.title, thumbnail: res.data.thumb };
  }
  throw new Error('Okatsu ytmp3 returned no download');
}

async function getIzumiDownloadByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&format=mp3`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.result?.download) return res.data.result;
  throw new Error('Izumi youtube?url returned no download');
}

async function getEliteProTechVideoByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.success && res?.data?.downloadURL) {
    return { download: res.data.downloadURL, title: res.data.title };
  }
  throw new Error('EliteProTech ytdown video returned no download');
}

async function getYupraVideoByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.success && res?.data?.data?.download_url) {
    return {
      download: res.data.data.download_url,
      title: res.data.data.title,
      thumbnail: res.data.data.thumbnail,
    };
  }
  throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
  const res = await tryRequest(() =>
    axios.get(
      `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`,
      AXIOS_DEFAULTS
    )
  );
  if (res?.data?.result?.mp4) {
    return { download: res.data.result.mp4, title: res.data.result.title };
  }
  throw new Error('Okatsu ytmp4 returned no mp4');
}

function videoQuality(value, fallback = '720') {
  return String(value || '').match(/(\d{3,4})/)?.[1] || fallback;
}

function pickQualityUrl(videos, wanted = '720') {
  if (!videos || typeof videos !== 'object' || Array.isArray(videos)) return null;
  const ladder = ['1080', '720', '480', '360', '240', '144'];
  const want = videoQuality(wanted);
  const start = Math.max(0, ladder.indexOf(want));
  for (const q of ladder.slice(start).concat(ladder.slice(0, start))) {
    const url = videos[q] || videos[`${q}p`];
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

function princeFileUrl(result, quality) {
  const direct = result?.downloadUrl || result?.download_url || result?.video || pickUrl(result);
  if (typeof direct === 'string' && /^https?:\/\//i.test(direct)) return direct;
  return pickQualityUrl(result?.videos, quality);
}

async function knightVideoDownload(url, format = '720p') {
  const { data } = await axios.get(`${knightBase()}/api/download/ytmp4`, {
    params: { apikey: knightKey(), format, url },
    timeout: 180000,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!data?.success) throw new Error(data?.result?.error || 'Knight API failed');
  const dl_url = pickUrl(data.result);
  if (!dl_url) throw new Error('Knight API returned no download URL');
  return { title: data.result?.title || 'Video', download: dl_url, sourceUrl: data.result?.url || url };
}

async function princeVideoDownload(url, quality = '720') {
  const watchUrl = toYouTubeWatchUrl(url);
  const q = videoQuality(quality);
  const endpoint = new URL('/api/download/ytvideo', princeBase());
  endpoint.searchParams.set('apikey', princeKey());
  endpoint.searchParams.set('quality', q);
  endpoint.searchParams.set('url', watchUrl);
  const { data, status } = await axios.get(endpoint.toString(), {
    timeout: 25000,
    validateStatus: () => true,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  const result = data?.result || data;
  if (status >= 400 || data?.success === false || result?.error) {
    throw new Error(result?.error || data?.message || data?.error || `Prince API HTTP ${status}`);
  }
  const dl_url = princeFileUrl(result, q);
  if (!dl_url) throw new Error('Prince API returned no download URL');
  return { title: result?.title || 'Video', download: dl_url, sourceUrl: watchUrl };
}

async function hectorVideoDownload(url, quality = '720') {
  const { data, status } = await axios.get('https://yt-dl.officialhectormanuel.workers.dev', {
    params: { url: toYouTubeWatchUrl(url) },
    timeout: 30000,
    validateStatus: () => true,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (status >= 400 || data?.status === false) {
    throw new Error(data?.message || data?.error || `Hector API HTTP ${status}`);
  }
  const q = videoQuality(quality);
  const dl_url =
    pickQualityUrl(data?.videos, q) ||
    pickQualityUrl(data?.result?.videos, q) ||
    princeFileUrl(data, q);
  if (!dl_url || /[?&]format=mp3(?:&|$)/i.test(dl_url)) {
    throw new Error('Hector API returned no video URL');
  }
  return { title: data?.title || 'Video', download: dl_url, sourceUrl: url };
}

function isAudioDownloadUrl(url) {
  const u = String(url || '');
  return /mime_type=audio_|ies-music\.tiktokcdn|audio_mpeg|\/audio\//i.test(u);
}

async function knightTikTokDownload(url) {
  const { data } = await axios.get(`${knightBase()}/api/download/tiktok`, {
    params: { apikey: knightKey(), url },
    timeout: 180000,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!data?.success) throw new Error(data?.result?.error || 'Knight API failed');
  const result = data.result || {};
  const images = Array.isArray(result.images)
    ? result.images.filter((u) => /^https?:\/\//i.test(u))
    : [];
  const dl_url = pickUrl(result);
  // Photo slideshow posts return audio as download + images[]
  if (!dl_url && !images.length) throw new Error('Knight API returned no download URL');
  return {
    title: result.title || 'TikTok Video',
    thumbnail: result.thumbnail || null,
    download: dl_url && !isAudioDownloadUrl(dl_url) ? dl_url : null,
    audio: dl_url && isAudioDownloadUrl(dl_url) ? dl_url : null,
    images,
  };
}

function pickAiText(data) {
  if (!data) return null;
  if (typeof data === 'string' && data.trim()) return data.trim();
  const candidates = [
    data.result,
    data.msg,
    data.message,
    data.answer,
    data.response,
    data.data?.response,
    data.data?.result,
    data.data?.message,
    data.data,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object' && typeof c.text === 'string' && c.text.trim()) return c.text.trim();
  }
  return null;
}

async function knightChatAI(text) {
  const { data, status } = await axios.get(`${knightBase()}/api/ai/chat`, {
    params: { apikey: knightKey(), text, query: text, q: text },
    timeout: 60000,
    validateStatus: () => true,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (status >= 400 || data?.success === false) {
    throw new Error(data?.error || data?.message || data?.result?.error || `Knight AI HTTP ${status}`);
  }
  const answer = pickAiText(data);
  if (!answer) throw new Error('Knight AI returned empty response');
  return answer;
}

async function knightGptAI(text) {
  const { data, status } = await axios.get(`${knightBase()}/api/ai/gpt`, {
    params: { apikey: knightKey(), text, query: text, q: text },
    timeout: 60000,
    validateStatus: () => true,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (status >= 400 || data?.success === false) {
    throw new Error(data?.error || data?.message || data?.result?.error || `Knight GPT HTTP ${status}`);
  }
  const answer = pickAiText(data);
  if (!answer) throw new Error('Knight GPT returned empty response');
  return answer;
}

async function fallbackChatAI(text) {
  const endpoints = [
    () => axios.get('https://api.shizo.top/ai/gpt', {
      params: { apikey: 'shizo', query: text },
      timeout: 30000,
      headers: { 'User-Agent': UA },
    }),
    () => axios.get('https://zellapi.autos/ai/chatbot', {
      params: { text },
      timeout: 30000,
      headers: { 'User-Agent': UA },
    }),
    () => axios.get('https://vapis.my.id/api/gemini', {
      params: { q: text },
      timeout: 30000,
      headers: { 'User-Agent': UA },
    }),
  ];
  let lastError;
  for (const run of endpoints) {
    try {
      const { data } = await run();
      const answer = pickAiText(data);
      if (answer) return answer;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All AI fallbacks failed');
}

async function knightFacebookDownload(url) {
  const { data } = await axios.get(`${knightBase()}/api/download/facebook`, {
    params: { apikey: knightKey(), url },
    timeout: 180000,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!data?.success) throw new Error(data?.result?.error || 'Knight API failed');
  const dl_url = pickUrl(data.result);
  if (!dl_url) throw new Error('Knight API returned no download URL');
  return { title: data.result?.title || 'Facebook Video', download: dl_url };
}

function isMediaUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) && !/error|cannot be null/i.test(url);
}

async function getTwitterElite(url) {
  const { data } = await axios.get('https://eliteprotech-apis.zone.id/x', {
    params: { url },
    timeout: 30000,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (data?.status !== 'success') throw new Error('Elite X API failed');
  const videos = (data.videos || []).filter((v) => isMediaUrl(v?.url));
  const mp3Url = isMediaUrl(data.mp3?.url) ? data.mp3.url : null;
  const thumbnail = isMediaUrl(data.thumbnail) ? data.thumbnail : null;
  if (!videos.length && !thumbnail && !mp3Url) throw new Error('No media in Elite response');
  return { videos, mp3Url, thumbnail };
}

async function getTwitterPrince(url) {
  const { data } = await axios.get(`${princeBase()}/api/download/twitter`, {
    params: { apikey: princeKey(), url },
    timeout: 30000,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!data?.success) throw new Error('Prince Twitter API failed');
  const result = data.result || {};
  const videos = (result.videoUrls || []).filter((v) => isMediaUrl(v?.url));
  const thumbnail = isMediaUrl(result.thumbnail) ? result.thumbnail : null;
  if (!videos.length && !thumbnail) throw new Error('No media in Prince response');
  return { videos, mp3Url: null, thumbnail };
}

module.exports = {
  api,
  UA,
  AXIOS_DEFAULTS,
  sleep,
  tryRequest,
  pickUrl,
  isIpLockedCdn,
  isMediaUrl,
  knightBase,
  knightKey,
  toYouTubeWatchUrl,
  knightSongDownload,
  hectorSongDownload,
  princeSongDownload,
  prexzySongDownload,
  getEliteProTechDownloadByUrl,
  getYupraDownloadByUrl,
  getOkatsuDownloadByUrl,
  getIzumiDownloadByUrl,
  getEliteProTechVideoByUrl,
  getYupraVideoByUrl,
  getOkatsuVideoByUrl,
  knightVideoDownload,
  princeVideoDownload,
  hectorVideoDownload,
  knightTikTokDownload,
  knightChatAI,
  knightGptAI,
  fallbackChatAI,
  pickAiText,
  knightFacebookDownload,
  getTwitterElite,
  getTwitterPrince,
};
