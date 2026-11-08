const { handleGoodbye } = require('../lib/welcome');
const { isGoodByeOn, getGoodbye } = require('../lib/index');
const { lidToMention } = require('../lib/jidHelper');
const fetch = require('node-fetch');

async function goodbyeCommand(sock, chatId, message, match) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    const text = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleGoodbye(sock, chatId, message, matchText);
}

function resolveParticipantIds(participant) {
    if (typeof participant === 'string') {
        return [participant];
    }
    if (!participant || typeof participant !== 'object') {
        return [String(participant)];
    }
    return [
        participant.phoneNumber,
        participant.jid,
        participant.id,
        participant.lid,
    ].filter(Boolean);
}

async function handleLeaveEvent(sock, id, participants) {
    const isGoodbyeEnabled = await isGoodByeOn(id);
    if (!isGoodbyeEnabled) return;

    const customMessage = await getGoodbye(id);
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;

    for (const participant of participants) {
        try {
            const ids = resolveParticipantIds(participant);
            const mention = lidToMention([
                typeof participant === 'object' ? participant?.phoneNumber : null,
                ...ids,
            ]);
            const mentionJid = mention.jid || ids[0];
            const displayName = mention.number || (mentionJid ? mentionJid.split('@')[0] : 'user');
            const mentionTag = `@${displayName}`;
            const mentions = mention.mentions.length ? mention.mentions : (mentionJid ? [mentionJid] : []);

            let finalMessage;
            if (customMessage) {
                finalMessage = customMessage
                    .replace(/{user}/g, mentionTag)
                    .replace(/{group}/g, groupName);
            } else {
                finalMessage = ` *${mentionTag}* we will never miss you! `;
            }

            try {
                let profilePicUrl = `https://img.pyrocdn.com/dbKUgahg.png`;
                try {
                    const profilePic = await sock.profilePictureUrl(mentionJid, 'image');
                    if (profilePic) profilePicUrl = profilePic;
                } catch {
                    console.log('Could not fetch profile picture, using default');
                }

                const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming1?type=leave&textcolor=red&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;

                const response = await fetch(apiUrl);
                if (response.ok) {
                    const imageBuffer = await response.buffer();
                    await sock.sendMessage(id, {
                        image: imageBuffer,
                        caption: finalMessage,
                        mentions
                    });
                    continue;
                }
            } catch {
                console.log('Image generation failed, falling back to text');
            }

            await sock.sendMessage(id, {
                text: finalMessage,
                mentions
            });
        } catch (error) {
            console.error('Error sending goodbye message:', error);
            const ids = resolveParticipantIds(participant);
            const mention = lidToMention(ids);
            const mentionJid = mention.jid || ids[0];
            const displayName = mention.number || (mentionJid ? mentionJid.split('@')[0] : 'user');
            const mentions = mention.mentions.length ? mention.mentions : (mentionJid ? [mentionJid] : []);

            let fallbackMessage;
            if (customMessage) {
                fallbackMessage = customMessage
                    .replace(/{user}/g, `@${displayName}`)
                    .replace(/{group}/g, groupName);
            } else {
                fallbackMessage = `Goodbye @${displayName}! 👋`;
            }

            await sock.sendMessage(id, {
                text: fallbackMessage,
                mentions
            });
        }
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
