// isAdmin.js
async function isAdmin(sock, chatId, senderId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Extract bot's pure phone number
        const botNumber = sock.user.id.split(':')[0]; // 16305199236

        const senderNumber = senderId.split(':')[0];

        // Check if bot is admin
        const isBotAdmin = participants.some(p => {
            // Check multiple possible ID formats
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            
            // Match against bot ID in multiple ways
            const botMatches = (
                sock.user.id === p.id || // Direct ID match
                botNumber === pPhoneNumber || // Phone number match
                botNumber === pId || // ID portion match
                sock.user.id.split('@')[0] === pPhoneNumber || // Bot ID phone vs participant phone
                sock.user.id.split('@')[0] === pId // Bot ID phone vs participant ID
            );
            
            return botMatches && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        // Check if sender is admin
        const isSenderAdmin = participants.some(p => {
            // Check multiple possible ID formats
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            
            // Match against sender ID in multiple ways
            const senderMatches = (
                senderId === p.id || // Direct ID match
                senderNumber === pPhoneNumber || // Phone number match
                senderNumber === pId || // ID portion match
                senderId.split('@')[0] === pPhoneNumber || // Sender ID phone vs participant phone
                senderId.split('@')[0] === pId // Sender ID phone vs participant ID
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
