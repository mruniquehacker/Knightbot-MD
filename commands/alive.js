const settings = require("../settings");
const axios =ž require('axios');

async function aliveCommand(sock, chatId, message) {
    try {
        const message1 = `🤖 *KA-BOT-MD is Active!*\n\n` +
            `*Version:* ${settings.version}\n` +
            `*Status:* Online\n` +
            `*Mode:* Public\n\n` +
            `*⭐ Features:*\n` +
            `• Group Management\n` +
            `• Antilink Protection\n` +
            `• Fun Commands\n` +
            `• And more!\n\n` +
            `*Developer:* Kartik Das\n` +
            `🦚 *Hare Krishna (Bengali Song)* 🎵`;

        // 1. Text Message Bhejein
        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363161513685998@newsletter',
                    newsletterName: 'KA-BOT-MD',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

        // 2. Online Bengali Krishna Song Search karke bhejne ke liye API call
        let searchQuery = "Bengali krishna song audio status";
        let apiResponse = await axios.get(`https://delirius-apiofc.vercel.app/search/ytsearch?q=${encodeURIComponent(searchQuery)}`);
        
        if (apiResponse.data && apiResponse.data.data && apiResponse.data.data.length > 0) {
            // Randomly ek naya Bengali Krishna gana pick karega taaki har baar change hokar aaye
            let randomSong = apiResponse.data.data[Math.floor(Math.random() * 5)];
            let audioUrl = randomSong.url;

            // Audio send karne ka command
            await sock.sendMessage(chatId, {
                audio: { url: audioUrl },
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: 'Bot is alive and running! Hare Krishna 🙏' }, { quoted: message });
    }
}

module.exports = aliveCommand;


global.footer = "🔥 Powered & Developed by Kartik Editz";

