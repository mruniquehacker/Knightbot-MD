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

        // Use Hanggts API
        async function fetchFromApi(u) {
            const apiUrl = `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(u)}`;
            
            try {
                const response = await axios.get(apiUrl, {
                    timeout: 20000,
                    headers: {
                        'accept': '*/*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    maxRedirects: 5,
                    validateStatus: s => s >= 200 && s < 500
                });
                
                if (response.data) {
                    // Accept response if status is true, or if response has data/result/url fields
                    if (response.data.status === true || 
                        response.data.result || 
                        response.data.data || 
                        response.data.url || 
                        response.data.download || 
                        response.data.video) {
                        return { response, apiName: 'Hanggts API' };
                    }
                }
            } catch (error) {
                console.error(`Hanggts API failed: ${error.message}`);
            }
            throw new Error('Hanggts API failed');
        }

        // Try resolved URL, then fallback to original URL
        let apiResult;
        try {
            apiResult = await fetchFromApi(resolvedUrl);
        } catch {
            apiResult = await fetchFromApi(url);
        }

        const response = apiResult.response;
        const apiName = apiResult.apiName;
        const data = response.data;

        let fbvid = null;
        let title = null;

        // Handle Hanggts API response format
        // Try parsing even if status is not explicitly true
        if (data) {
            // Try different possible response structures
            if (data.result) {
                // Hanggts API format: data.result.media.video_hd or video_sd
                if (data.result.media) {
                    // Prefer HD, fallback to SD
                    fbvid = data.result.media.video_hd || data.result.media.video_sd;
                    title = data.result.info?.title || data.result.title || data.title || "Facebook Video";
                }
                // Check if result is an object with url
                else if (typeof data.result === 'object' && data.result.url) {
                    fbvid = data.result.url;
                    title = data.result.title || data.result.caption || data.title || "Facebook Video";
                } 
                // Check if result is a string (direct URL)
                else if (typeof data.result === 'string' && data.result.startsWith('http')) {
                    fbvid = data.result;
                    title = data.title || "Facebook Video";
                }
                // Check if result has download or video property
                else if (data.result.download) {
                    fbvid = data.result.download;
                    title = data.result.title || data.title || "Facebook Video";
                } else if (data.result.video) {
                    fbvid = data.result.video;
                    title = data.result.title || data.title || "Facebook Video";
                }
            }
            
            if (!fbvid && data.data) {
                if (typeof data.data === 'object' && data.data.url) {
                    fbvid = data.data.url;
                    title = data.data.title || data.data.caption || data.title || "Facebook Video";
                } else if (typeof data.data === 'string' && data.data.startsWith('http')) {
                    fbvid = data.data;
                    title = data.title || "Facebook Video";
                } else if (Array.isArray(data.data) && data.data.length > 0) {
                    // Array format - find best quality
                    const hdVideo = data.data.find(item => (item.quality === 'HD' || item.quality === 'high') && (item.format === 'mp4' || !item.format));
                    const sdVideo = data.data.find(item => (item.quality === 'SD' || item.quality === 'low') && (item.format === 'mp4' || !item.format));
                    fbvid = hdVideo?.url || sdVideo?.url || data.data[0]?.url;
                    title = hdVideo?.title || sdVideo?.title || data.data[0]?.title || data.title || "Facebook Video";
                } else if (data.data.download) {
                    fbvid = data.data.download;
                    title = data.data.title || data.title || "Facebook Video";
                } else if (data.data.video) {
                    fbvid = data.data.video;
                    title = data.data.title || data.title || "Facebook Video";
                }
            }
            
            if (!fbvid && data.url) {
                fbvid = data.url;
                title = data.title || data.caption || "Facebook Video";
            }
            
            if (!fbvid && data.download) {
                fbvid = data.download;
                title = data.title || "Facebook Video";
            }
            
            if (!fbvid && data.video) {
                if (typeof data.video === 'string') {
                    fbvid = data.video;
                } else if (data.video.url) {
                    fbvid = data.video.url;
                }
                title = data.title || data.video.title || "Facebook Video";
            }
        }

        if (!fbvid) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Failed to get video URL from Facebook.\n\nPossible reasons:\n• Video is private or deleted\n• Link is invalid\n• Video is not available for download\n\nPlease try a different Facebook video link.'
            }, { quoted: message });
        }

        // Try URL method first (more reliable)
        try {
            const caption = title ? `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗞𝗡𝗜𝗚𝗛𝗧-𝗕𝗢𝗧\n\n📝 Title: ${title}` : "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗞𝗡𝗜𝗚𝗛𝗧-𝗕𝗢𝗧";
            
            await sock.sendMessage(chatId, {
                video: { url: fbvid },
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: message });
            
            return;
        } catch (urlError) {
            console.error(`URL method failed: ${urlError.message}`);
            
            // Fallback to buffer method
            try {
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
                    timeout: 60000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
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
                const caption = title ? `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗞𝗡𝗜𝗚𝗛𝗧-𝗕𝗢𝗧\n\n📝 Title: ${title}` : "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗞𝗡𝗜𝗚𝗛𝗧-𝗕𝗢𝗧";
                
                await sock.sendMessage(chatId, {
                    video: { url: tempFile },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });

                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (err) {
                    console.error('Error cleaning up temp file:', err);
                }
                return;
            } catch (bufferError) {
                console.error(`Buffer method also failed: ${bufferError.message}`);
                throw new Error('Both URL and buffer methods failed');
            }
        }

    } catch (error) {
        console.error('Error in Facebook command:', error);
        await sock.sendMessage(chatId, { 
            text: "An error occurred. API might be down. Error: " + error.message
        }, { quoted: message });
    }
}

module.exports = facebookCommand; 