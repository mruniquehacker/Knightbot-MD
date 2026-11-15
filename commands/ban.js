const fs = require('fs');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');
const settings = require('../settings');

async function banCommand(sock, chatId, message) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        
        if (isGroup) {
            const senderId = message.key.participant || message.key.remoteJid;
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
            
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: '🗿 *Aukat nahi hai teri!* Pehle mujhe group ka Admin bana, tabhi hukum chalega.\n\n🙏 *Radhe Radhe 🦚*', ...channelInfo }, { quoted: message });
                return;
            }
            
            if (!isSenderAdmin && !message.key.fromMe) {
                await sock.sendMessage(chatId, { text: '⚠️ *Limit mein reh!* Yeh command sirf group admins ke liye hai, aam janta ke liye nahi. 😎\n\n🙏 *Radhe Radhe 🦚*', ...channelInfo }, { quoted: message });
                return;
            }
        } else {
            const senderId = message.key.participant || message.key.remoteJid;
            const senderIsSudo = await isSudo(senderId);
            if (!message.key.fromMe && !senderIsSudo) {
                await sock.sendMessage(chatId, { text: '👑 *System Warning:* Sirf mere Master/Owner (**Kartik Editz**) ko hi yeh power mili hai.\n\n🙏 *Radhe Radhe 🦚*', ...channelInfo }, { quoted: message });
                return;
            }
        }

        let userToBan;

        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToBan = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToBan = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userToBan) {
            await sock.sendMessage(chatId, {
                text: '🗿 *Nishana chuk gaya bhai!* Us bande ki chat par reply kar ya mention kar jise system se bahar fenkna hai.\n\n🔥 *KA-BOT-MD | Developer: Kartik Editz*\n🙏 *Radhe Radhe 🦚*',
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // Prevent banning the bot itself
        try {
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            if (userToBan === botId || userToBan === sock.user.id) {
                await sock.sendMessage(chatId, { text: '😏 *Itni aukaat nahi hai teri!* Khud ke banane wale aur system ko hi ban karega?\n\n🙏 *Radhe Radhe 🦚*', ...channelInfo }, { quoted: message });
                return;
            }
        } catch {}

        try {
            // Add user to banned list database
            let bannedUsers = [];
            if (fs.existsSync('./data/banned.json')) {
                bannedUsers = JSON.parse(fs.readFileSync('./data/banned.json'));
            }

            if (!bannedUsers.includes(userToBan)) {
                bannedUsers.push(userToBan];
                
                const dir = './data';
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync('./data/banned.json', JSON.stringify(bannedUsers, null, 2));

                await sock.sendMessage(chatId, {
                    text: `🔥 *Khatam, Bye, Tata!* 🗿\n@${userToBan.split('@')[0]} ko system aur bot ki duniya se permanently blacklisted/ban kar diya gaya hai. Ab yeh bot isse baat nahi karega!\n\n👑 *Powered by Kartik Editz*\n🙏 *Radhe Radhe 🦚*`,
                    mentions: [userToBan],
                    ...channelInfo
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${userToBan.split('@')[0]} pehle se hi ban list mein pada hai. Dobara zaleel mat karwa usko! 😎\n\n🙏 *Radhe Radhe 🦚*`,
                    mentions: [userToBan],
                    ...channelInfo
                }, { quoted: message });
            }
        } catch (err) {
            console.error('Error in ban database:', err);
        }

    } catch (error) {
        console.error('Error in ban command:', error);
        await sock.sendMessage(chatId, { text: '❌ *System Glitch!* Ban process mein thodi rukavat aayi hai, par attitude high rakho.\n\n🙏 *Radhe Radhe 🦚*', ...channelInfo }, { quoted: message });
    }
}

module.exports = banCommand;

