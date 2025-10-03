const settings = require('../settings');
const { isSudo } = require('./index');

async function isOwnerOrSudo(senderId) {
    // Get owner number from settings
    const ownerJid = settings.ownerNumber + "@s.whatsapp.net";
    
    // Direct comparison with phone number JID
    if (senderId === ownerJid) {
        return true;
    }
    
    // Handle LID format - check if senderId is a LID
    // LIDs are typically longer and don't contain @s.whatsapp.net
    if (senderId && !senderId.includes('@s.whatsapp.net') && !senderId.includes('@g.us')) {
        // For LID format, we need to check if it's the owner
        // Since we can't easily reverse LID to phone number, we'll check if the LID
        // corresponds to the owner by checking if the phone number part matches
        const phoneNumberMatch = senderId.includes(settings.ownerNumber);
        if (phoneNumberMatch) {
            return true;
        }
    }
    
    try {
        const sudoResult = await isSudo(senderId);
        return sudoResult;
    } catch (e) {
        return false;
    }
}

module.exports = isOwnerOrSudo;