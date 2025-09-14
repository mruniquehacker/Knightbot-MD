/*Créditos A Quien Correspondan 
Play Traido y Editado 
Por Cuervo-Team-Supreme*/
const axios = require('axios');
const crypto = require('crypto');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const ytdl = require('@distube/ytdl-core');
let ytdlp;
try { ytdlp = require('yt-dlp-exec'); } catch (_) { ytdlp = null; }

// Helper: richer diagnostics for axios/network errors
function logAxiosError(prefix, error) {
	try {
		const status = error?.response?.status;
		const statusText = error?.response?.statusText;
		const url = error?.config?.url;
		const method = error?.config?.method;
		const headers = error?.response?.headers;
		const dataPreview = (() => {
			if (!error?.response?.data) return undefined;
			if (Buffer.isBuffer(error.response.data)) return `<buffer ${error.response.data.length} bytes>`;
			const str = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
			return str.slice(0, 500);
		})();
		console.error(`[${prefix}] AxiosError:`, {
			message: error?.message,
			code: error?.code,
			url,
			method,
			status,
			statusText,
			headers,
			dataPreview
		});
	} catch (e) {
		console.error(`[${prefix}] Failed to log axios error`, e);
	}
}

// PrinceTech YT-MP3 API client
const princeApi = {
    base: 'https://api.princetechn.com/api/download/ytmp3',
    apikey: process.env.PRINCE_API_KEY || 'prince_tech_api_azfsbshfb',
    async fetchMeta(videoUrl) {
        const params = new URLSearchParams({ apikey: this.apikey, url: videoUrl });
        const url = `${this.base}?${params.toString()}`;
        
        const { data } = await axios.get(url, {
            timeout: 20000,
            headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' }
        });
        return data;
    }
};

const savetube = {
   api: {
      base: "https://media.savetube.me/api",
      cdn: "/random-cdn",
      info: "/v2/info",
      download: "/download"
   },
   headers: {
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://yt.savetube.me',
      'referer': 'https://yt.savetube.me/',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
   },
   formats: ['144', '240', '360', '480', '720', '1080', 'mp3'],
   crypto: {
      hexToBuffer: (hexString) => {
         const matches = hexString.match(/.{1,2}/g);
         return Buffer.from(matches.join(''), 'hex');
      },
      decrypt: async (enc) => {
         try {
            const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
            const data = Buffer.from(enc, 'base64');
            const iv = data.slice(0, 16);
            const content = data.slice(16);
            const key = savetube.crypto.hexToBuffer(secretKey);
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
            let decrypted = decipher.update(content);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return JSON.parse(decrypted.toString());
         } catch (error) {
            throw new Error(error)
         }
      }
   },
   youtube: url => {
      if (!url) return null;
      const a = [
         /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
         /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
         /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
         /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
         /youtu\.be\/([a-zA-Z0-9_-]{11})/
      ];
      for (let b of a) {
         if (b.test(url)) return url.match(b)[1];
      }
      return null
   },
   request: async (endpoint, data = {}, method = 'post') => {
      try {
         const {
            data: response
         } = await axios({
            method,
            url: `${endpoint.startsWith('http') ? '' : savetube.api.base}${endpoint}`,
            data: method === 'post' ? data : undefined,
            params: method === 'get' ? data : undefined,
            headers: savetube.headers,
            timeout: 20000,
            maxRedirects: 3,
         })
         return {
            status: true,
            code: 200,
            data: response
         }
      } catch (error) {
         logAxiosError('SAVETUBE.request', error);
         throw error;
      }
   },
   getCDN: async () => {
      console.log(`[SAVETUBE] Fetching CDN host...`);
      const response = await savetube.request(savetube.api.cdn, {}, 'get');
      if (!response.status) throw new Error(response)
      return {
         status: true,
         code: 200,
         data: response.data.cdn
      }
   },
   download: async (link, format) => {
      console.log(`[SAVETUBE] Starting download for: ${link}, format: ${format}`);
      
      if (!link) {
         console.log(`[SAVETUBE] No link provided`);
         return {
            status: false,
            code: 400,
            error: "No link provided. Please provide a valid YouTube link."
         }
      }
      if (!format || !savetube.formats.includes(format)) {
         console.log(`[SAVETUBE] Invalid format: ${format}`);
         return {
            status: false,
            code: 400,
            error: "Invalid format. Please choose one of the available formats: 144, 240, 360, 480, 720, 1080, mp3.",
            available_fmt: savetube.formats
         }
      }
      const id = savetube.youtube(link);
      console.log(`[SAVETUBE] Extracted YouTube ID: ${id}`);
      
      if (!id) {
         console.log(`[SAVETUBE] Invalid YouTube link - no ID extracted`);
         throw new Error('Invalid YouTube link.');
      }
      
      try {
         console.log(`[SAVETUBE] Getting CDN...`);
         const cdnx = await savetube.getCDN();
         if (!cdnx.status) {
            console.log(`[SAVETUBE] CDN request failed:`, cdnx);
            return cdnx;
         }
         const cdn = cdnx.data;
         console.log(`[SAVETUBE] Got CDN: ${cdn}`);
         
         console.log(`[SAVETUBE] Requesting video info...`);
         const result = await savetube.request(`https://${cdn}${savetube.api.info}`, {
            url: `https://www.youtube.com/watch?v=${id}`
         });
         if (!result.status) {
            console.log(`[SAVETUBE] Info request failed:`, result);
            return result;
         }
         console.log(`[SAVETUBE] Got video info, attempting decryption...`);
         
         const decrypted = await savetube.crypto.decrypt(result.data.data);
         console.log(`[SAVETUBE] Decryption successful, title: ${decrypted.title}`);
         
         var dl;
         try {
            console.log(`[SAVETUBE] Requesting download link...`);
            dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
               id: id,
               downloadType: format === 'mp3' ? 'audio' : 'video',
               quality: format === 'mp3' ? '128' : format,
               key: decrypted.key
            });
            console.log(`[SAVETUBE] Download request successful`);
         } catch (error) {
            logAxiosError('SAVETUBE.downloadLink', error);
            throw new Error('Failed to get download link. Please try again later.');
         };
         
         console.log(`[SAVETUBE] Download URL: ${dl.data.data.downloadUrl}`);
         
         return {
            status: true,
            code: 200,
            result: {
               title: decrypted.title || "Unknown Title",
               type: format === 'mp3' ? 'audio' : 'video',
               format: format,
               thumbnail: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/0.jpg`,
               download: dl.data.data.downloadUrl,
               id: id,
               key: decrypted.key,
               duration: decrypted.duration,
               quality: format === 'mp3' ? '128' : format,
               downloaded: dl.data.data.downloaded
            }
         }
      } catch (error) {
         console.error(`[SAVETUBE] Error in download function:`, error);
         throw new Error('An error occurred while processing your request. Please try again later.');
      }
   }
};

// Fallback via Piped API (public YouTube proxy instances)
const piped = {
   instances: [
      'https://piped.video',
      'https://piped.lunar.icu',
      'https://piped.projectsegfau.lt',
      'https://piped.privacy.com.de',
      'https://piped.privacydev.net',
      'https://watch.leptons.xyz',
      'https://piped.us.projectsegfau.lt',
      'https://piped.seitan-ayoub.lol',
      'https://piped.smnz.de',
      'https://piped.syncpundit.io',
      'https://piped.tokhmi.xyz'
   ],
   getStreams: async (videoId) => {
      for (const base of piped.instances) {
         try {
            console.log(`[PIPED] Trying instance: ${base}`);
            const { data } = await axios.get(`${base}/api/v1/streams/${videoId}`, {
               headers: { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' },
               timeout: 15000
            });
            if (data && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
               console.log(`[PIPED] Found ${data.audioStreams.length} audio streams on ${base}`);
               return { ok: true, base, streams: data.audioStreams };
            }
            console.warn(`[PIPED] No audioStreams on ${base}`);
         } catch (e) {
            console.warn(`[PIPED] Instance failed: ${base} -> ${e?.message || e}`);
         }
      }
      return { ok: false };
   }
}

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: "What song do you want to download?" }, { quoted: message });
        }

        // Determine if input is a YouTube link or search query
        let videoUrl = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { text: "No songs found!" }, { quoted: message });
            }
            videoUrl = videos[0].url;
            var selectedTitle = videos[0].title || searchQuery;
        }

        // Send thumbnail immediately
        try {
            const ytId = (savetube.youtube(videoUrl) || '').trim();
            const thumbUrl = ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined;
            const captionTitle = typeof selectedTitle === 'string' && selectedTitle.length > 0 ? selectedTitle : searchQuery || 'Song';
            if (thumbUrl) {
                await sock.sendMessage(chatId, {
                    image: { url: thumbUrl },
                    caption: `*${captionTitle}*\nDownloading...`
                }, { quoted: message });
            }
        } catch (e) {
            console.error('[SONG] Error sending thumbnail:', e?.message || e);
        }

        // Primary: PrinceTech API
        let result;
        try {
            const meta = await princeApi.fetchMeta(videoUrl);
            if (meta?.success && meta?.result?.download_url) {
                result = {
                    status: true,
                    code: 200,
                    result: {
                        title: meta.result.title,
                        type: 'audio',
                        format: 'm4a',
                        thumbnail: meta.result.thumbnail,
                        download: meta.result.download_url,
                        id: meta.result.id,
                        quality: meta.result.quality
                    }
                };
            } else {
                throw new Error('PrinceTech API did not return a download_url');
            }
        } catch (err) {
            console.error(`[SONG] PrinceTech API failed:`);
            if (err?.isAxiosError) logAxiosError('SONG.prince', err); else console.error(err);
            // Fallback to ytdl-core
            try {
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                const tempFile = path.join(tempDir, `${Date.now()}.mp3`);

                const ytHeaders = {
                    'cookie': 'VISITOR_INFO1_LIVE=; PREF=f1=50000000&tz=UTC; YSC=',
                    'user-agent': 'Mozilla/5.0'
                };
                const info = await ytdl.getInfo(videoUrl, { requestOptions: { headers: ytHeaders } });
                await new Promise((resolve, reject) => {
                    const ffmpeg = require('fluent-ffmpeg');
                    const stream = ytdl(videoUrl, {
                        quality: 'highestaudio',
                        filter: 'audioonly',
                        highWaterMark: 1 << 25,
                        requestOptions: { headers: ytHeaders }
                    });
                    stream.on('error', (e) => {
                        console.error('[SONG] ytdl stream error:', e?.message || e);
                    });
                    ffmpeg(stream)
                        .audioBitrate(128)
                        .toFormat('mp3')
                        .save(tempFile)
                        .on('end', resolve)
                        .on('error', (e) => {
                            console.error('[SONG] ffmpeg error:', e?.message || e);
                            reject(e);
                        });
                });

                await sock.sendMessage(chatId, {
                    audio: { url: tempFile },
                    mimetype: "audio/mpeg",
                    fileName: `${(info?.videoDetails?.title || 'song')}.mp3`,
                    ptt: false
                }, { quoted: message });

                setTimeout(() => {
                    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch {}
                }, 2000);

                return;
            } catch (fbErr) {
                console.error('[SONG] ytdl-core fallback failed:', fbErr?.message || fbErr);
                // Next fallback: yt-dlp
                try {
                    if (!ytdlp) throw new Error('yt-dlp-exec not installed');
                    const tempDir = path.join(__dirname, '../temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                    const outBase = path.join(tempDir, `${Date.now()}`);
                    const output = `${outBase}.%(ext)s`;

                    await ytdlp(videoUrl, {
                        output,
                        extractAudio: true,
                        audioFormat: 'mp3',
                        audioQuality: '0',
                        noProgress: true,
                        noPart: true,
                        addHeader: [
                            'user-agent: Mozilla/5.0',
                            'referer: https://www.youtube.com/'
                        ]
                    });

                    const outFile = `${outBase}.mp3`;
                    await sock.sendMessage(chatId, {
                        audio: { url: outFile },
                        mimetype: 'audio/mpeg',
                        fileName: `${(searchQuery || 'song')}.mp3`,
                        ptt: false
                    }, { quoted: message });

                    setTimeout(() => {
                        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
                    }, 2000);

                    return;
                } catch (dlpErr) {
                    console.error('[SONG] yt-dlp fallback failed:', dlpErr?.message || dlpErr);
                }

                // Final fallback: Piped API
                try {
                    const id = savetube.youtube(videoUrl);
                    if (!id) throw new Error('Unable to extract video ID for Piped fallback');
                    const resp = await piped.getStreams(id);
                    if (!resp.ok) throw new Error('No audio streams available via Piped');

                    const sorted = resp.streams
                        .slice()
                        .sort((a, b) => (parseInt(b.bitrate || '0') || 0) - (parseInt(a.bitrate || '0') || 0));
                    const preferred = sorted.find(s => (s.mimeType || '').includes('audio/mp4')) || sorted[0];
                    const mime = preferred.mimeType || 'audio/mp4';
                    const ext = mime.includes('webm') ? 'webm' : (mime.includes('mp4') ? 'm4a' : 'audio');

                    const tempIn = path.join(tempDir, `${Date.now()}.${ext}`);
                    const tempOut = path.join(tempDir, `${Date.now()}-conv.mp3`);

                    const dlResp = await axios({ url: preferred.url, method: 'GET', responseType: 'stream', timeout: 30000, maxRedirects: 5 });
                    await new Promise((resolve, reject) => {
                        const w = fs.createWriteStream(tempIn);
                        dlResp.data.pipe(w);
                        w.on('finish', resolve);
                        w.on('error', reject);
                    });

                    let converted = false;
                    try {
                        const ffmpeg = require('fluent-ffmpeg');
                        await new Promise((resolve, reject) => {
                            ffmpeg(tempIn)
                                .audioBitrate(128)
                                .toFormat('mp3')
                                .save(tempOut)
                                .on('end', resolve)
                                .on('error', reject);
                        });
                        converted = true;
                    } catch (convErr) {
                        console.warn('[SONG] Conversion failed, sending original file:', convErr?.message || convErr);
                    }

                    await sock.sendMessage(chatId, {
                        audio: { url: converted ? tempOut : tempIn },
                        mimetype: converted ? 'audio/mpeg' : mime,
                        fileName: `${(searchQuery || 'song')}.${converted ? 'mp3' : ext}`,
                        ptt: false
                    }, { quoted: message });

                    setTimeout(() => {
                        try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch {}
                        try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch {}
                    }, 2000);

                    return;
                } catch (pErr) {
                    console.error('[SONG] Piped fallback failed:', pErr?.message || pErr);
            return await sock.sendMessage(chatId, { text: "Failed to fetch download link. Try again later." });
                }
            }
        }
        
        if (!result || !result.status || !result.result || !result.result.download) {
            console.error(`[SONG] Invalid result structure:`, JSON.stringify(result, null, 2));
            return await sock.sendMessage(chatId, { text: "Failed to get a valid download link from the API." }, { quoted: message });
        }

        // Minimal logs: only errors, so do not log the download URL

        // Download the audio file
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        // Minimal logs

        let response;
        try {
            response = await axios({
                url: result.result.download,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000,
                maxRedirects: 5,
                headers: { 'user-agent': 'Mozilla/5.0' },
                validateStatus: () => true
            });
        } catch (err) {
            logAxiosError('SONG.fileDownload', err);
            return await sock.sendMessage(chatId, { text: "Failed to download the song (network error)." }, { quoted: message });
        }
        const ctHeader = response.headers?.['content-type'];
        const ct = Array.isArray(ctHeader) ? (ctHeader[0] || '') : (ctHeader || '');
        const ctLower = ct.toLowerCase();
        const guessedExt = ctLower.includes('audio/mp4') || ctLower.includes('mp4') ? 'm4a'
            : ctLower.includes('audio/webm') ? 'webm'
            : ctLower.includes('mpeg') ? 'mp3'
            : 'm4a';
        const isAudioCT = ctLower.startsWith('audio/') || ctLower.includes('mpeg') || ctLower.includes('mp4') || ctLower.includes('webm');
        const chosenMime = isAudioCT ? ctLower : (guessedExt === 'mp3' ? 'audio/mpeg' : guessedExt === 'webm' ? 'audio/webm' : 'audio/mp4');
        const tempFile = path.join(tempDir, `${Date.now()}.${guessedExt}`);
        // Minimal logs
        if (response.status < 200 || response.status >= 300) {
            console.error(`[SONG] HTTP error downloading file: ${response.status} ${response.statusText}`);
            return await sock.sendMessage(chatId, { text: "Failed to download the song file from the server (bad status)." }, { quoted: message });
        }

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(tempFile);
            response.data.on('error', (e) => {
                console.error('[SONG] Stream error from server:', e?.message || e);
                reject(e);
            });
            writer.on('finish', resolve);
            writer.on('close', resolve);
            writer.on('error', (e) => {
                console.error('[SONG] File write error:', e?.message || e);
                reject(e);
            });
            response.data.pipe(writer);
        });

        let fileSize = 0;
        try {
            const stats = fs.statSync(tempFile);
            fileSize = stats.size;
            // Minimal logs
        } catch {}
        if (!fileSize || fileSize < 10240) { // <10KB indicates failure
            return await sock.sendMessage(chatId, { text: "Song file seems invalid (too small). Please try again." }, { quoted: message });
        }

        // Convert to MP3 for maximum compatibility if needed
        let sendPath = tempFile;
        let sendMime = chosenMime;
        let sendName = `${result.result.title}.${guessedExt}`;
        let convPath = '';
        if (guessedExt !== 'mp3') {
            try {
                const ffmpeg = require('fluent-ffmpeg');
                convPath = path.join(tempDir, `${Date.now()}-conv.mp3`);
                // Minimal logs
                await new Promise((resolve, reject) => {
                    ffmpeg(tempFile)
                        .audioCodec('libmp3lame')
                        .audioBitrate(128)
                        .toFormat('mp3')
                        .save(convPath)
                        .on('end', resolve)
                        .on('error', reject);
                });
                sendPath = convPath;
                sendMime = 'audio/mpeg';
                sendName = `${result.result.title}.mp3`;
            } catch (e) {
                console.warn('[SONG] Conversion to MP3 failed, sending original file:', e?.message || e);
            }
        }

        await sock.sendMessage(chatId, {
            audio: { url: sendPath },
            mimetype: sendMime,
            fileName: sendName,
            ptt: false
        }, { quoted: message });

        // Minimal logs

        // Clean up temp file
        // Do not delete immediately; keep file around a bit longer for debugging
        setTimeout(() => {
            try {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                if (convPath && fs.existsSync(convPath)) fs.unlinkSync(convPath);
                // Minimal logs
            } catch {}
        }, 2000);
    } catch (error) {
        console.error(`[SONG] General error:`);
        if (error?.isAxiosError) logAxiosError('SONG.general', error); else console.error(error);
        await sock.sendMessage(chatId, { text: "Download failed. Please try again later." }, { quoted: message });
    }
}

module.exports = songCommand; 