const settings = require("../settings");

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let time = '';
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (secs > 0 || time === '') time += `${secs}s`;
    
    return time.trim();
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        await sock.sendMessage(chatId, { text: '⚡ Calculating Speed...' }, { quoted: message });
        const end = Date.now();
        const ping = Math.round((end - start) / 2);

        const uptimeInSeconds = process.uptime();
        const uptimeFormatted = formatTime(uptimeInSeconds);

        const botInfo = `
╔══════════════════════╗
║     🔥 *KA-BOT-MD* 🔥     
╚══════════════════════╝
│ ⚡ *Ping*    : ${ping} ms
│ ⏱️ *Uptime*  : ${uptimeFormatted}
│ 🏷️ *Version* : v${settings.version}
│ 🦚 *RADHE RADHE* 🙏
└──────────────────────┘
🔥 *Powered & Developed by Kartik Editz*`.trim();

        await sock.sendMessage(chatId, { text: botInfo }, { quoted: message });

    } catch (error) {
        console.error('Error in ping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get bot status.' }, { quoted: message });
    }
}

module.exports = pingCommand;

