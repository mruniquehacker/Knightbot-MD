const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        // Validate Facebook URL
        if (!url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a Facebook link."
            }, { quoted: message });
        }

        // Send loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        // Resolve share/short URLs to their final destination first
        let resolvedUrl = url;
        try {
            const res = await axios.get(url, { timeout: 20000, maxRedirects: 10, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const possible = res?.request?.res?.responseUrl;
            if (possible && typeof possible === 'string') {
                resolvedUrl = possible;
            }
        } catch {
            // ignore resolution errors; use original url
        }

        // Helper to call API with retries and variants
        async function fetchFromApi(u) {
            const apiUrl = `https://api.princetechn.com/api/download/facebook?apikey=prince&url=${encodeURIComponent(u)}`;
            return axios.get(apiUrl, {
                timeout: 40000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                },
                maxRedirects: 5,
                validateStatus: s => s >= 200 && s < 500
            });
        }

        // Try resolved URL, then fallback to original URL
        let response;
        try {
            response = await fetchFromApi(resolvedUrl);
            if (!response || response.status >= 400 || !response.data) throw new Error('bad');
        } catch {
            response = await fetchFromApi(url);
        }

        const data = response.data;

        if (!data || data.status !== 200 || !data.success || !data.result) {
            return await sock.sendMessage(chatId, { 
                text: 'Sorry the API did not return a valid response. Please try again later!'
            }, { quoted: message });
        }

        const fbvid = data.result.hd_video || data.result.sd_video;

        if (!fbvid) {
            return await sock.sendMessage(chatId, { 
                text: 'Wrong Facebook data. Please ensure the video exists.'
            }, { quoted: message });
        }

        // Create temp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Generate temp file path
        const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        // Download the video
        const videoResponse = await axios({
            method: 'GET',
            url: fbvid,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Range': 'bytes=0-',
                'Connection': 'keep-alive',
                'Referer': 'https://www.facebook.com/'
            }
        });

        const writer = fs.createWriteStream(tempFile);
        videoResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Check if file was downloaded successfully
        if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
            throw new Error('Failed to download video');
        }

        // Send the video
        await sock.sendMessage(chatId, {
            video: { url: tempFile },
            mimetype: "video/mp4",
            caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗞𝗡𝗜𝗚𝗛𝗧-𝗕𝗢𝗧"
        }, { quoted: message });

        // Clean up temp file
        try {
            fs.unlinkSync(tempFile);
        } catch (err) {
            console.error('Error cleaning up temp file:', err);
        }

    } catch (error) {
        console.error('Error in Facebook command:', error);
        await sock.sendMessage(chatId, { 
            text: "An error occurred. API might be down. Error: " + error.message
        }, { quoted: message });
    }
}

module.exports = facebookCommand; 