// isAdmin.js
async function isAdmin(sock, chatId, senderId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Extract bot's pure phone number
        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botNumber = botId.includes(':') ? botId.split(':')[0] : (botId.includes('@') ? botId.split('@')[0] : botId);
        const botIdWithoutSuffix = botId.includes('@') ? botId.split('@')[0] : botId;
        
        // Extract numeric part from bot LID (remove session identifier like :4)
        // botLid format: "30997433344120:4@lid" -> extract "30997433344120"
        const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
        const botLidWithoutSuffix = botLid.includes('@') ? botLid.split('@')[0] : botLid;

        const senderNumber = senderId.includes(':') ? senderId.split(':')[0] : (senderId.includes('@') ? senderId.split('@')[0] : senderId);
        const senderIdWithoutSuffix = senderId.includes('@') ? senderId.split('@')[0] : senderId;

        // Check if bot is admin
        const isBotAdmin = participants.some(p => {
            // Check multiple possible ID formats
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            const pLid = p.lid ? p.lid.split('@')[0] : '';
            const pFullId = p.id || '';
            const pFullLid = p.lid || '';
            
            // Extract numeric part from participant LID (remove session identifier if present)
            const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;
            
            // Match against bot ID in multiple ways
            const botMatches = (
                botId === pFullId || // Direct ID match
                botId === pFullLid || // Direct LID match (new Baileys format)
                botLid === pFullLid || // Bot LID vs participant LID (full match)
                botLidNumeric === pLidNumeric || // Bot LID numeric vs participant LID numeric (KEY FIX)
                botLidWithoutSuffix === pLid || // Bot LID without suffix vs participant LID
                botNumber === pPhoneNumber || // Phone number match
                botNumber === pId || // ID portion match
                botIdWithoutSuffix === pPhoneNumber || // Bot ID phone vs participant phone
                botIdWithoutSuffix === pId || // Bot ID phone vs participant ID
                (botLid && botLid.split('@')[0].split(':')[0] === pLid) // Bot LID numeric portion match
            );
            
            return botMatches && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        // Check if sender is admin
        const isSenderAdmin = participants.some(p => {
            // Check multiple possible ID formats
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            const pLid = p.lid ? p.lid.split('@')[0] : '';
            const pFullId = p.id || '';
            const pFullLid = p.lid || '';
            
            // Match against sender ID in multiple ways
            const senderMatches = (
                senderId === pFullId || // Direct ID match
                senderId === pFullLid || // Direct LID match (new Baileys format)
                senderNumber === pPhoneNumber || // Phone number match
                senderNumber === pId || // ID portion match
                senderIdWithoutSuffix === pPhoneNumber || // Sender ID phone vs participant phone
                senderIdWithoutSuffix === pId || // Sender ID phone vs participant ID
                (pLid && senderIdWithoutSuffix === pLid) // Sender LID vs participant LID
            );
            
            return senderMatches && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        return { isSenderAdmin, isBotAdmin };
    } catch (err) {
        console.error('❌ Error in isAdmin:', err);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;
