const axios = require('axios');

/**
 * Handles the soccer schedule command.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - The Baileys socket.
 * @param {string} chatId - The ID of the chat.
 * @param {import('@whiskeysockets/baileys').WAMessage} message - The message object.
 */
async function jadwalBolaCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: 'Mencari jadwal bola...' }, { quoted: message });

        const apiUrl = 'https://api.elrayyxml.web.id/api/information/jadwalbola';
        
        const { data } = await axios.get(apiUrl, {
            timeout: 20000, // 20 detik timeout
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // --- 🟩 BAGIAN PERBAIKAN (Sesuai JSON Kamu) 🟩 ---

        // Cek jika 'result' adalah array string dan tidak kosong
        if (!data || !data.status || !Array.isArray(data.result) || data.result.length === 0) {
            
            // Fallback jika API mengembalikan error sebagai string di 'result'
            if (data && data.status && typeof data.result === 'string') {
                await sock.sendMessage(chatId, { text: data.result }, { quoted: message });
                return;
            }
            
            throw new Error("API did not return a valid result array.");
        }

        const matches = data.result; // 'matches' sekarang adalah array berisi string

        // Membangun teks balasan
        let replyText = "⚽ *JADWAL BOLA HARI INI* ⚽\n\n";

        // Loop setiap string di dalam array 'result'
        for (const matchString of matches) {
            // matchString = "17 November 2025 - 00.00 - Azerbaijan vs France - Kualifikasi Piala Duni"
            // Kita hanya perlu menambahkannya sebagai list
            replyText += `*•* ${matchString}\n`;
        }
        
        replyText += `\n--------------------\nSumber: ElrayyXml API`;

        // Kirim pesan yang sudah diformat
        await sock.sendMessage(chatId, { text: replyText.trim() }, { quoted: message });
        
        // --- 🟥 BATAS AKHIR PERBAIKAN 🟥 ---

    } catch (error) {
        console.error('[JADWAL BOLA] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Gagal mengambil jadwal bola. Coba lagi nanti.' }, { quoted: message });
    }
}

module.exports = jadwalBolaCommand;