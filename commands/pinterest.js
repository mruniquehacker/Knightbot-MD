const axios = require('axios');
const { 
    prepareWAMessageMedia, 
    generateWAMessageFromContent, 
    proto 
} = require('@whiskeysockets/baileys');

/**
 * Handles the Pinterest search command with Carousel/Slides.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - The Baileys socket.
 * @param {string} chatId - The ID of the chat.
 * @param {import('@whiskeysockets/baileys').WAMessage} message - The message object.
 */
async function pinterestCommand(sock, chatId, message) {
    try {
        // 1. Ambil query dari pesan
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.pinterest';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: 'Contoh: .pinterest anime girl' }, { quoted: message });
            return;
        }

        // 2. Beri reaksi atau pesan tunggu
        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

        // 3. Panggil API Pinterest
        const BASE_URL = 'https://api.elrayyxml.web.id/api';
        const ENDPOINT = '/search/pinterest';
        const apiUrl = `${BASE_URL}${ENDPOINT}?q=${encodeURIComponent(query)}`;

        const { data } = await axios.get(apiUrl, { 
            timeout: 20000, 
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } 
        });

        const results = data.result;
        if (!results || !Array.isArray(results) || results.length === 0) {
            await sock.sendMessage(chatId, { text: 'Gambar tidak ditemukan.' }, { quoted: message });
            return;
        }

        // 4. Siapkan Data untuk Carousel (Ambil maksimal 5 gambar agar tidak berat)
        const topResults = results.slice(0, 5);
        const cards = [];

        // Loop setiap hasil untuk membuat "Kartu"
        for (const result of topResults) {
            if (!result.images_url) continue;

            // Upload gambar ke server WA agar bisa jadi header kartu
            // Menggunakan imageMessage dari prepareWAMessageMedia
            const media = await prepareWAMessageMedia({ 
                image: { url: result.images_url } 
            }, { upload: sock.waUploadToServer });

            cards.push({
                body: proto.Message.InteractiveMessage.Body.fromObject({
                    text: result.grid_title || `Result for: ${query}`
                }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                    text: "© Pinterest Search"
                }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: "",
                    hasMediaAttachment: true,
                    imageMessage: media.imageMessage 
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                    buttons: [
                        {
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "Source Image",
                                url: result.images_url,
                                merchant_url: result.images_url
                            })
                        }
                    ]
                })
            });
        }

        // 5. Susun Pesan Interactive (Carousel)
        const msg = generateWAMessageFromContent(chatId, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: `Berikut hasil pencarian Pinterest untuk: *${query}*`
                        }),
                        carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                            cards: cards
                        })
                    })
                }
            }
        }, { quoted: message });

        // 6. Kirim Pesan menggunakan relayMessage
        await sock.relayMessage(chatId, msg.message, { messageId: msg.key.id });

    } catch (error) {
        console.error('[PINTEREST ERROR]', error);
        await sock.sendMessage(chatId, { text: 'Terjadi kesalahan saat mengambil data.' }, { quoted: message });
    }
}

module.exports = pinterestCommand;