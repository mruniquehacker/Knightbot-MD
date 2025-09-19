const isAdmin = require('../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: 'Only admins can use the .hidetag command.' }, { quoted: message });
        return;
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants || [];
    const nonAdmins = participants.filter(p => !p.admin).map(p => p.id);

    if (replyMessage) {
        let content = {};
        if (replyMessage.imageMessage) {
            const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
            content = { image: { url: filePath }, caption: messageText || replyMessage.imageMessage.caption || '', mentions: nonAdmins };
        } else if (replyMessage.videoMessage) {
            const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
            content = { video: { url: filePath }, caption: messageText || replyMessage.videoMessage.caption || '', mentions: nonAdmins };
        } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
            content = { text: replyMessage.conversation || replyMessage.extendedTextMessage.text, mentions: nonAdmins };
        } else if (replyMessage.documentMessage) {
            const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
            content = { document: { url: filePath }, fileName: replyMessage.documentMessage.fileName, caption: messageText || '', mentions: nonAdmins };
        }

        if (Object.keys(content).length > 0) {
            await sock.sendMessage(chatId, content);
        }
    } else {
        await sock.sendMessage(chatId, { text: messageText || 'Tagged members (excluding admins).', mentions: nonAdmins });
    }
}

module.exports = hideTagCommand;


