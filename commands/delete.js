const isAdmin = require('../lib/isAdmin');
const store = require('../lib/lightweight_store');

async function deleteCommand(sock, chatId, message, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: 'I need to be an admin to delete messages.' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'Only admins can use the .delete command.' }, { quoted: message });
            return;
        }

        // Determine target user and count
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let countArg = 1;
        if (parts.length > 1) {
            const maybeNum = parseInt(parts[1], 10);
            if (!isNaN(maybeNum) && maybeNum > 0) countArg = Math.min(maybeNum, 50);
        }

        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const mentioned = Array.isArray(ctxInfo.mentionedJid) && ctxInfo.mentionedJid.length > 0 ? ctxInfo.mentionedJid[0] : null;
        const repliedParticipant = ctxInfo.participant || null;

        // Determine target user: replied > mentioned; if neither, do not proceed
        let targetUser = null;
        let repliedMsgId = null;
        if (repliedParticipant && ctxInfo.stanzaId) {
            targetUser = repliedParticipant;
            repliedMsgId = ctxInfo.stanzaId;
        } else if (mentioned) {
            targetUser = mentioned;
        } else {
            await sock.sendMessage(chatId, { text: 'Please reply to a user\'s message or mention a user to delete their recent messages.' }, { quoted: message });
            return;
        }

        // Gather last N messages from targetUser in this chat
        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        // Newest last; we traverse from end backwards
        const toDelete = [];
        const seenIds = new Set();

        // If replying, prioritize deleting the exact replied message first (counts toward N)
        if (repliedMsgId) {
            const repliedInStore = chatMessages.find(m => m.key.id === repliedMsgId && (m.key.participant || m.key.remoteJid) === targetUser);
            if (repliedInStore) {
                toDelete.push(repliedInStore);
                seenIds.add(repliedInStore.key.id);
            } else {
                // If not found in store, still attempt delete directly
                try {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: repliedMsgId,
                            participant: repliedParticipant
                        }
                    });
                    // Count this as one deleted and reduce required count
                    countArg = Math.max(0, countArg - 1);
                } catch {}
            }
        }
        for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
            const m = chatMessages[i];
            const participant = m.key.participant || m.key.remoteJid;
            if (participant === targetUser && !seenIds.has(m.key.id)) {
                // skip protocol/system messages
                if (!m.message?.protocolMessage) {
                    toDelete.push(m);
                    seenIds.add(m.key.id);
                }
            }
        }

        if (toDelete.length === 0) {
            await sock.sendMessage(chatId, { text: 'No recent messages found for the target user.' }, { quoted: message });
            return;
        }

        // Delete sequentially with small delay
        for (const m of toDelete) {
            try {
                const msgParticipant = m.key.participant || targetUser;
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.key.id,
                        participant: msgParticipant
                    }
                });
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                // continue
            }
        }

       // await sock.sendMessage(chatId, { text: `Deleted ${toDelete.length} message(s) from @${(targetUser||'').split('@')[0]}`, mentions: [targetUser] }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, { text: 'Failed to delete messages.' }, { quoted: message });
    }
}

module.exports = deleteCommand;

