const { handleGoodbye } = require('../lib/welcome');
const { isGoodByeOn } = require('../lib/index');
const fetch = require('node-fetch');

async function goodbyeCommand(sock, chatId, message, match) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleGoodbye(sock, chatId, message, matchText);
}

async function handleLeaveEvent(sock, id, participants) {
    // Check if goodbye is enabled for this group
    const isGoodbyeEnabled = await isGoodByeOn(id);
    if (!isGoodbyeEnabled) return;

    // Get group metadata
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;

    // Send goodbye message for each leaving participant
    for (const participant of participants) {
        try {
            const user = participant.split('@')[0];
            
            // Get user's display name
            let displayName = user; // Default to phone number
            try {
                const contact = await sock.getBusinessProfile(participant);
                if (contact && contact.name) {
                    displayName = contact.name;
                } else {
                    // Try to get from group participants
                    const groupParticipants = groupMetadata.participants;
                    const userParticipant = groupParticipants.find(p => p.id === participant);
                    if (userParticipant && userParticipant.name) {
                        displayName = userParticipant.name;
                    }
                }
            } catch (nameError) {
                console.log('Could not fetch display name, using phone number');
            }
            
            // Get user profile picture
            let profilePicUrl = `https://img.pyrocdn.com/dbKUgahg.png`; // Default avatar
            try {
                const profilePic = await sock.profilePictureUrl(participant, 'image');
                if (profilePic) {
                    profilePicUrl = profilePic;
                }
            } catch (profileError) {
                console.log('Could not fetch profile picture, using default');
            }
            
            // Construct API URL for goodbye image
            const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming1?type=leave&textcolor=red&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;
            
            // Fetch the goodbye image
            const response = await fetch(apiUrl);
            if (response.ok) {
                const imageBuffer = await response.buffer();
                
                // Send goodbye image with stylish caption
                await sock.sendMessage(id, {
                    image: imageBuffer,
                    caption: ` *@${displayName}* we will never miss you! `,
                    mentions: [participant]
                });
            } else {
                // Fallback to text message if API fails
                const goodbyeMessage = ` *@${displayName}* we will never miss you! `;
                await sock.sendMessage(id, {
                    text: goodbyeMessage,
                    mentions: [participant]
                });
            }
        } catch (error) {
            console.error('Error sending goodbye message:', error);
            // Fallback to text message
            const user = participant.split('@')[0];
            const goodbyeMessage = ` *@${user}* we will never miss you! `;
            await sock.sendMessage(id, {
                text: goodbyeMessage,
                mentions: [participant]
            });
        }
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
