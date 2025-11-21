const axios = require('axios');

/**
 * Handles the YouTube Play Video command.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - The Baileys socket.
 * @param {string} chatId - The ID of the chat.
 * @param {import('@whiskeysockets/baileys').WAMessage} message - The message object.
 */
async function ytplayvidCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            '';

        // Tentukan command, misal .ytplayvid
        const used = (rawText || '').split(/\s+/)[0] || '.ytplayvid';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: 'Usage: .ytplayvid <search query>\nExample: .ytplayvid mr beast' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: 'Mencari video...' }, { quoted: message });

        // --- 🟩 BAGIAN API (Sesuai Info Kamu) 🟩 ---
        
        const BASE_URL = 'https://api.elrayyxml.web.id/api';
        const ENDPOINT = '/downloader/ytplayvid';
        const PARAM_NAME = 'q'; 

        const apiUrl = `${BASE_URL}${ENDPOINT}?${PARAM_NAME}=${encodeURIComponent(query)}`;
        
        const { data } = await axios.get(apiUrl, {
            timeout: 60000, // Timeout 60 detik (untuk jaga-jaga jika API lambat)
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // --- 🟩 PARSING JSON (Sesuai Struktur Kamu) 🟩 ---

        if (!data || data.status !== true || !data.result) {
            throw new Error("API did not return a successful result.");
        }

        const r = data.result;

        // Ambil data dari JSON
        const videoUrl = r.download_url;
        const title = r.title || 'YouTube Video';
        const channel = r.channel || 'N/A';
        const duration = r.duration || 'N/A';
        const views = r.views || 'N/A';
        const thumbnailUrl = r.thumbnail; // Bisa dipakai untuk caption

        if (!videoUrl) {
            throw new Error("API result did not contain a 'download_url'.");
        }

        // Buat caption yang informatif
        const caption = `*${title}*

*Channel:* ${channel}
*Durasi:* ${duration}
*Views:* ${views}`;

        // Kirim video menggunakan link download
        await sock.sendMessage(chatId, { 
            video: { url: videoUrl },
            caption: caption
        }, { quoted: message });
        
        // --- 🟥 BATAS AKHIR FITUR 🟥 ---

    } catch (error) {
        console.error('[YTPLAYVID] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Gagal mengambil video. Coba query lain atau ulangi nanti.' }, { quoted: message });
    }
}

module.exports = ytplayvidCommand;