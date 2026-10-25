const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');
const { lidToMention } = require('../lib/jidHelper');
const fetch = require('node-fetch');

async function welcomeCommand(sock, chatId, message, match) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    const text = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
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

async function handleJoinEvent(sock, id, participants) {
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    const customMessage = await getWelcome(id);
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';

    for (const participant of participants) {
        try {
            const ids = resolveParticipantIds(participant);
            // Refresh metadata so phoneNumber is available after LID join events
            let metaParticipant = null;
            try {
                const fresh = await sock.groupMetadata(id);
                metaParticipant = fresh.participants.find((p) =>
                    ids.some((cand) =>
                        [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).some(
                            (x) => String(x).split('@')[0].split(':')[0] === String(cand).split('@')[0].split(':')[0]
                        )
                    )
                );
            } catch {}
            const mention = lidToMention([
                metaParticipant?.phoneNumber,
                metaParticipant?.id,
                metaParticipant?.lid,
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
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });

                finalMessage = `╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: ${mentionTag} 👋\n┃Member count: #${groupMetadata.participants.length}\n┃𝚃𝙸𝙼𝙴: ${timeString}⏰\n╰━━━━━━━━━━━━━━━╯\n\n*${mentionTag}* Welcome to *${groupName}*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\n${groupDesc}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ Knight Bot*`;
            }

            try {
                let profilePicUrl = `https://img.pyrocdn.com/dbKUgahg.png`;
                try {
                    const profilePic = await sock.profilePictureUrl(mentionJid, 'image');
                    if (profilePic) profilePicUrl = profilePic;
                } catch {
                    console.log('Could not fetch profile picture, using default');
                }

                const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;

                const response = await fetch(apiUrl);
                if (response.ok) {
                    const imageBuffer = await response.buffer();
                    await sock.sendMessage(id, {
                        image: imageBuffer,
                        caption: finalMessage,
                        mentions,
                        ...channelInfo
                    });
                    continue;
                }
            } catch {
                console.log('Image generation failed, falling back to text');
            }

            await sock.sendMessage(id, {
                text: finalMessage,
                mentions,
                ...channelInfo
            });
        } catch (error) {
            console.error('Error sending welcome message:', error);
            const ids = resolveParticipantIds(participant);
            const mention = lidToMention(ids);
            const mentionJid = mention.jid || ids[0];
            const displayName = mention.number || (mentionJid ? mentionJid.split('@')[0] : 'user');
            const mentions = mention.mentions.length ? mention.mentions : (mentionJid ? [mentionJid] : []);

            let fallbackMessage;
            if (customMessage) {
                fallbackMessage = customMessage
                    .replace(/{user}/g, `@${displayName}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                fallbackMessage = `Welcome @${displayName} to ${groupName}! 🎉`;
            }

            await sock.sendMessage(id, {
                text: fallbackMessage,
                mentions,
                ...channelInfo
            });
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
