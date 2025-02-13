const fs = require('fs');
const path = require('path');
const isAdmin = require('../helpers/isAdmin');

// Define paths
const databaseDir = path.join(process.cwd(), 'database');
const warningsPath = path.join(databaseDir, 'warnings.json');

// Initialize warnings file if it doesn't exist
function initializeWarningsFile() {
    // Create database directory if it doesn't exist
    if (!fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    // Create warnings.json if it doesn't exist
    if (!fs.existsSync(warningsPath)) {
        fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
    }
}

async function warnCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        // Initialize files first
        initializeWarningsFile();

        // First check if it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: 'This command can only be used in groups!'
            });
            return;
        }

        // Check admin status first
        try {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
            
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Error: Please make the bot an admin first to use this command.'
                });
                return;
            }

            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Error: Only group admins can use the warn command.'
                });
                return;
            }
        } catch (adminError) {
            console.error('Error checking admin status:', adminError);
            await sock.sendMessage(chatId, { 
                text: '❌ Error: Please make sure the bot is an admin of this group.'
            });
            return;
        }

        let userToWarn;
        
        // Check for mentioned users
        if (mentionedJids && mentionedJids.length > 0) {
            userToWarn = mentionedJids[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToWarn = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToWarn) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error: Please mention the user or reply to their message to warn!'
            });
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            // Read warnings, create empty object if file is empty
            let warnings = {};
            try {
                warnings = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
            } catch (error) {
                warnings = {};
            }

            // Initialize nested objects if they don't exist
            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;
            
            warnings[chatId][userToWarn]++;
            fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

            const warningMessage = `*『 WARNING ALERT 』*\n\n` +
                `👤 *Warned User:* @${userToWarn.split('@')[0]}\n` +
                `⚠️ *Warning Count:* ${warnings[chatId][userToWarn]}/3\n` +
                `👑 *Warned By:* @${senderId.split('@')[0]}\n\n` +
                `📅 *Date:* ${new Date().toLocaleString()}`;

            await sock.sendMessage(chatId, { 
                text: warningMessage,
                mentions: [userToWarn, senderId]
            });

            // Auto-kick after 3 warnings
            if (warnings[chatId][userToWarn] >= 3) {
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

                await sock.groupParticipantsUpdate(chatId, [userToWarn], "remove");
                delete warnings[chatId][userToWarn];
                fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
                
                const kickMessage = `*『 AUTO-KICK 』*\n\n` +
                    `@${userToWarn.split('@')[0]} has been removed from the group after receiving 3 warnings! ⚠️`;

                await sock.sendMessage(chatId, { 
                    text: kickMessage,
                    mentions: [userToWarn]
                });
            }
        } catch (error) {
            console.error('Error in warn command:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to warn user!'
            });
        }
    } catch (error) {
        console.error('Error in warn command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: '❌ Rate limit reached. Please try again in a few seconds.'
                });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to warn user. Make sure the bot is admin and has sufficient permissions.'
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

module.exports = warnCommand;
