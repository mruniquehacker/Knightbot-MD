const { ttdl } = require("ruhend-scraper"); // Masih disimpan sebagai fallback
const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link for the video." });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link for the video." });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { text: "That is not a valid TikTok link. Please provide a valid TikTok video link." });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        try {
            // --- 🟩 BAGIAN API ELRAYYXML (Sudah Diperbaiki) 🟩 ---
            
            const BASE_URL = 'https://api.elrayyxml.web.id/api';
            const ENDPOINT = '/search/tiktok'; // Sesuai link JSON kamu
            const PARAM_NAME = 'q'; // Sesuai link JSON kamu

            const apiUrl = `${BASE_URL}${ENDPOINT}?${PARAM_NAME}=${encodeURIComponent(url)}`;

            let videoUrl = null;
            let audioUrl = null;
            let title = null;

            // Panggil API ElrayyXml
            try {
                const response = await axios.get(apiUrl, { 
                    timeout: 20000, // Waktu tunggu ditambah jadi 20 detik
                    headers: {
                        'accept': '*/*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36'
                    }
                });
                
                // --- 🟩 PARSING JSON (Sesuai Struktur Kamu) 🟩 ---
                if (response.data && response.data.status && Array.isArray(response.data.result) && response.data.result.length > 0) {
                    
                    // Ambil object pertama dari array 'result'
                    const r = response.data.result[0];

                    // Ambil data video dari 'r.data'
                    videoUrl = r.data;
                    
                    // Ambil data audio dari 'r.music_info.url'
                    audioUrl = r.music_info?.url; // Tanda '?' untuk jaga-jaga jika music_info tidak ada
                    
                    // Ambil judul dari 'r.title'
                    title = r.title || "TikTok Video";

                    if (!videoUrl) {
                        throw new Error("No video URL found in elrayyxml API response (field 'data' is missing or empty)");
                    }
                } else {
                    throw new Error("Invalid elrayyxml API response (status not true or 'result' is not a valid array)");
                }
                // --- 🟥 BATAS PARSING 🟥 ---

            } catch (apiError) {
                console.error(`ElrayyXml API failed: ${apiError.message}`);
                // Biarkan error ini, agar kode lanjut ke fallback (ttdl)
            }
            // --- 🟩 BATAS AKHIR PERUBAHAN 🟩 ---


            // Jika API ElrayyXml gagal (videoUrl masih null), coba fallback ttdl
            if (!videoUrl) {
                console.log("ElrayyXml API failed, trying ttdl (ruhend-scraper) fallback...");
                try {
                    let downloadData = await ttdl(url);
                    if (downloadData && downloadData.data && downloadData.data.length > 0) {
                        const mediaData = downloadData.data;
                        for (let i = 0; i < Math.min(20, mediaData.length); i++) {
                            const media = mediaData[i];
                            const mediaUrl = media.url;
                            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || media.type === 'video';

                            if (isVideo) {
                                await sock.sendMessage(chatId, {
                                    video: { url: mediaUrl },
                                    mimetype: "video/mp4",
                                    caption: "DOWNLOADED BY JARVIS(Fallback)"
                                }, { quoted: message });
                            }
                            // ... (Sisa logika fallback kamu) ...
                        }
                        return; // Selesai setelah mengirim dari fallback
                    }
                } catch (ttdlError) {
                    console.error("ttdl fallback also failed:", ttdlError.message);
                }
            }

            // Jika kita dapat URL (dari ElrayyXml), kirim videonya
            if (videoUrl) {
                try {
                    // Coba kirim pakai URL dulu, ini lebih cepat
                    const caption = title ? `DOWNLOADED BY JARVIS\n\n📝 Title: ${title}` : "DOWNLOADED BY JARVIS";
                    
                    await sock.sendMessage(chatId, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption: caption
                    }, { quoted: message });

                    // Jika kita dapat audioUrl, kirim juga
                    if (audioUrl) {
                        try {
                             await sock.sendMessage(chatId, {
                                audio: { url: audioUrl },
                                mimetype: "audio/mp3",
                                fileName: `${title || 'TikTok Audio'}.mp3`
                            }, { quoted: message });
                        } catch (audioError) {
                            console.error(`Failed to send audio URL: ${audioError.message}`);
                        }
                    }
                    return;
                } catch (urlError) {
                    console.error(`Failed to send video via URL: ${urlError.message}. Trying buffer download...`);
                    // Jika kirim via URL gagal (mungkin karena link-nya expired), coba download sebagai buffer
                    try {
                         const videoResponse = await axios.get(videoUrl, {
                            responseType: 'arraybuffer',
                            timeout: 60000,
                            maxContentLength: 100 * 1024 * 1024,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        
                        const videoBuffer = Buffer.from(videoResponse.data);
                        if (videoBuffer.length === 0) throw new Error("Video buffer is empty");
                        
                        const caption = title ? `DOWNLOADED BY JARVIS\n\n📝 Title: ${title}` : "DOWNLOADED BY JARVIS";
                        
                        await sock.sendMessage(chatId, {
                            video: videoBuffer,
                            mimetype: "video/mp4",
                            caption: caption
                        }, { quoted: message });
                        
                        // Kirim audio juga jika ada
                         if (audioUrl) {
                            try {
                                const audioBuffer = await axios.get(audioUrl, { responseType: 'arraybuffer' });
                                await sock.sendMessage(chatId, {
                                    audio: Buffer.from(audioBuffer.data),
                                    mimetype: "audio/mp3",
                                    fileName: `${title || 'TikTok Audio'}.mp3`
                                }, { quoted: message });
                            } catch (audioError) {
                                console.error(`Failed to download audio buffer: ${audioError.message}`);
                            }
                        }
                        return;

                    } catch (downloadError) {
                         console.error(`Buffer download method also failed: ${downloadError.message}`);
                    }
                }
            }

            // Jika semua metode gagal
            return await sock.sendMessage(chatId, { 
                text: "❌ Failed to download TikTok video. All download methods failed. Please try again with a different link."
            },{ quoted: message });
        } catch (error) {
            console.error('Error in TikTok download:', error);
            await sock.sendMessage(chatId, { 
                text: "Failed to download the TikTok video. Please try again with a different link."
            },{ quoted: message });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { 
            text: "An error occurred while processing the request. Please try again later."
        },{ quoted: message });
    }
}

module.exports = tiktokCommand;