const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fs = require('fs');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn } = require('./lib/index');

// Command imports
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const banCommand = require('./commands/ban');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const isAdmin = require('./lib/isAdmin');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');
const { incrementMessageCount, topMembers } = require('./commands/topmembers');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const { handleAntilinkCommand, handleLinkDetection } = require('./commands/antilink');
const { Antilink } = require('./lib/antilink');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const { startHangman, guessLetter } = require('./commands/hangman');
const { startTrivia, answerTrivia } = require('./commands/trivia');
const { complimentCommand } = require('./commands/compliment');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const blurCommand = require('./commands/img-blur');
const welcomeCommand = require('./commands/welcome');
const goodbyeCommand = require('./commands/goodbye');
const githubCommand = require('./commands/github');
const { handleAntiBadwordCommand, handleBadwordDetection } = require('./lib/antibadword');
const antibadwordCommand = require('./commands/antibadword');
const { handleChatbotCommand, handleChatbotResponse } = require('./commands/chatbot');
const takeCommand = require('./commands/take');
const { flirtCommand } = require('./commands/flirt');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const shipCommand = require('./commands/ship');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const unbanCommand = require('./commands/unban');
const emojimixCommand = require('./commands/emojimix');
const { handlePromotionEvent } = require('./commands/promote');
const { handleDemotionEvent } = require('./commands/demote');
const viewOnceCommand = require('./commands/viewonce');
const clearSessionCommand = require('./commands/clearsession');
const { autoStatusCommand, handleStatusUpdate } = require('./commands/autostatus');
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const stickerTelegramCommand = require('./commands/stickertelegram');
const textmakerCommand = require('./commands/textmaker');
const { handleAntideleteCommand, handleMessageRevocation, storeMessage } = require('./commands/antidelete');
const clearTmpCommand = require('./commands/cleartmp');
const setProfilePicture = require('./commands/setpp');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const playCommand = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
const songCommand = require('./commands/song');
const aiCommand = require('./commands/ai');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { addCommandReaction, handleAreactCommand } = require('./lib/reactions');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');
const imagineCommand = require('./commands/imagine');
const videoCommand = require('./commands/video');


// Global settings
global.packname = settings.packname;
global.author = settings.author;
global.channelLink = "https://whatsapp.com/channel/0029VapCMAkBPzjaNnlx4k0c";
global.ytch = "KELIN MD";

// Add this near the top of main.js with other global configurations
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '',
            newsletterName: 'KELIN MD',
            serverMessageId: -1
        }
    }
};

async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        // Store message for antidelete feature
        if (message.message) {
            storeMessage(message);
        }

        // Handle message revocation
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        const userMessage = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            ''
        ).toLowerCase().replace(/\.\\s+/g, '.').trim();

        // Preserve raw message for commands like .tag that need original casing
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        // Only log command usage
        if (userMessage.startsWith('.')) {
            console.log(`📝 Command used in ${isGroup ? 'group' : 'private'}: ${userMessage}`);
        }

        // Check if user is banned (skip ban check for unban command)
        if (isBanned(senderId) && !userMessage.startsWith('.unban')) {
            // Only respond occasionally to avoid spam
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: '❌ You are banned from using the bot. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        // First check if it's a game move
        if (/^[1-9]$/.test(userMessage) || userMessage.toLowerCase() === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        /*  // Basic message response in private chat
          if (!isGroup && (userMessage === 'hi' || userMessage === 'hello' || userMessage === 'bot' || userMessage === 'hlo' || userMessage === 'hey' || userMessage === 'bro')) {
              await sock.sendMessage(chatId, {
                  text: 'Hi, How can I help you?\nYou can use .menu for more info and commands.',
                  ...channelInfo
              });
              return;
          } */

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Check for bad words FIRST, before ANY other processing
        if (isGroup && userMessage) {
            await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
        }

        // Then check for command prefix
        if (!userMessage.startsWith('.')) {
            if (isGroup) {
                // Process non-command messages first
                await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                await Antilink(message, sock);
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            }
            return;
        }

        // List of admin commands
        const adminCommands = ['.mute', '.unmute', '.ban', '.unban', '.promote', '.demote', '.kick', '.tagall', '.antilink'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

        // List of owner commands
        const ownerCommands = ['.mode', '.autostatus', '.antidelete', '.cleartmp', '.setpp', '.clearsession', '.areact', '.autoreact'];
        const isOwnerCommand = ownerCommands.some(cmd => userMessage.startsWith(cmd));

        let isSenderAdmin = false;
        let isBotAdmin = false;

        // Check admin status only for admin commands in groups
        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId, message);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, {quoted: message});
                return;
            }

            if (
                userMessage.startsWith('.mute') ||
                userMessage === '.unmute' ||
                userMessage.startsWith('.ban') ||
                userMessage.startsWith('.unban') ||
                userMessage.startsWith('.promote') ||
                userMessage.startsWith('.demote')
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Sorry, only group admins can use this command.',
                        ...channelInfo
                    });
                    return;
                }
            }
        }

        // Check owner status for owner commands
        if (isOwnerCommand) {
            // Check if message is from owner (fromMe) or bot itself
            if (!message.key.fromMe) {
                await sock.sendMessage(chatId, {
                    text: '❌ This command is only available for the owner!',
                    ...channelInfo
                });
                return;
            }
        }

        // Add this near the start of your message handling logic, before processing commands
        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            // Allow owner to use bot even in private mode
            if (!data.isPublic && !message.key.fromMe) {
                return; // Silently ignore messages from non-owners when in private mode
            }
        } catch (error) {
            console.error('Error checking access mode:', error);
            // Default to public mode if there's an error reading the file
        }

        // Command handlers
        switch (true) {
            case userMessage === '.simage': {
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessage?.stickerMessage) {
                    await simageCommand(sock, quotedMessage, chatId);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the .simage command to convert it.', ...channelInfo });
                }
                break;
            }
            case userMessage.startsWith('.kick'):
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;
            case userMessage.startsWith('.mute'):
                const muteDuration = parseInt(userMessage.split(' ')[1]);
                if (isNaN(muteDuration)) {
                    await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes.\neg to mute 10 minutes\n.mute 10', ...channelInfo });
                } else {
                    await muteCommand(sock, chatId, senderId, muteDuration);
                }
                break;
            case userMessage === '.unmute':
                await unmuteCommand(sock, chatId, senderId);
                break;
            case userMessage.startsWith('.ban'):
                await banCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.unban'):
                await unbanCommand(sock, chatId, message);
                break;
            case userMessage === '.help' || userMessage === '.menu' || userMessage === '.bot' || userMessage === '.list':
                await helpCommand(sock, chatId, message, global.channelLink);
                break;
            case userMessage === '.sticker' || userMessage === '.s':
                await stickerCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.warnings'):
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;
            case userMessage.startsWith('.warn'):
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;
            case userMessage.startsWith('.tts'):
                const text = userMessage.slice(4).trim();
                await ttsCommand(sock, chatId, text, message);
                break;
            case userMessage === '.delete' || userMessage === '.del':
                await deleteCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.attp'):
                await attpCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.mode'):
                // Check if sender is the owner
                if (!message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!', ...channelInfo });
                    return;
                }
                // Read current data first
                let data;
                try {
                    data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                } catch (error) {
                    console.error('Error reading access mode:', error);
                    await sock.sendMessage(chatId, { text: 'Failed to read bot mode status', ...channelInfo });
                    return;
                }

                const action = userMessage.split(' ')[1]?.toLowerCase();
                // If no argument provided, show current status
                if (!action) {
                    const currentMode = data.isPublic ? 'public' : 'private';
                    await sock.sendMessage(chatId, {
                        text: `Current bot mode: *${currentMode}*\n\nUsage: .mode public/private\n\nExample:\n.mode public - Allow everyone to use bot\n.mode private - Restrict to owner only`,
                        ...channelInfo
                    });
                    return;
                }

                if (action !== 'public' && action !== 'private') {
                    await sock.sendMessage(chatId, {
                        text: 'Usage: .mode public/private\n\nExample:\n.mode public - Allow everyone to use bot\n.mode private - Restrict to owner only',
                        ...channelInfo
                    });
                    return;
                }

                try {
                    // Update access mode
                    data.isPublic = action === 'public';

                    // Save updated data
                    fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));

                    await sock.sendMessage(chatId, { text: `Bot is now in *${action}* mode`, ...channelInfo });
                } catch (error) {
                    console.error('Error updating access mode:', error);
                    await sock.sendMessage(chatId, { text: 'Failed to update bot access mode', ...channelInfo });
                }
                break;
            case userMessage === '.owner':
                await ownerCommand(sock, chatId);
                break;
            case userMessage === '.tagall':
                if (isSenderAdmin || message.key.fromMe) {
                    await tagAllCommand(sock, chatId, senderId, message);
                } else {
                    await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use the .tagall command.', ...channelInfo }, {quoted: message});
                }
                break;
            case userMessage.startsWith('.tag'):
                const messageText = rawText.slice(4).trim();  // use rawText here, not userMessage
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage);
                break;
            case userMessage.startsWith('.antilink'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    });
                    return;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin);
                break;
            case userMessage === '.meme':
                await memeCommand(sock, chatId, message);
                break;
            case userMessage === '.joke':
                await jokeCommand(sock, chatId, message);
                break;
            case userMessage === '.quote':
                await quoteCommand(sock, chatId, message);
                break;
            case userMessage === '.fact':
                await factCommand(sock, chatId, message, message);
                break;
            case userMessage.startsWith('.weather'):
                const city = userMessage.slice(9).trim();
                if (city) {
                    await weatherCommand(sock, chatId, city);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please specify a city, e.g., .weather London', ...channelInfo });
                }
                break;
            case userMessage === '.news':
                await newsCommand(sock, chatId);
                break;
            case userMessage.startsWith('.ttt') || userMessage.startsWith('.tictactoe'):
                const tttText = userMessage.split(' ').slice(1).join(' ');
                await tictactoeCommand(sock, chatId, senderId, tttText);
                break;
            case userMessage.startsWith('.move'):
                const position = parseInt(userMessage.split(' ')[1]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { text: 'Please provide a valid position number for Tic-Tac-Toe move.', ...channelInfo });
                } else {
                    tictactoeMove(sock, chatId, senderId, position);
                }
                break;
            case userMessage === '.topmembers':
                topMembers(sock, chatId, isGroup);
                break;
            case userMessage.startsWith('.hangman'):
                startHangman(sock, chatId);
                break;
            case userMessage.startsWith('.guess'):
                const guessedLetter = userMessage.split(' ')[1];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: 'Please guess a letter using .guess <letter>', ...channelInfo });
                }
                break;
            case userMessage.startsWith('.trivia'):
                startTrivia(sock, chatId);
                break;
            case userMessage.startsWith('.answer'):
                const answer = userMessage.split(' ').slice(1).join(' ');
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: 'Please provide an answer using .answer <answer>', ...channelInfo });
                }
                break;
            case userMessage.startsWith('.compliment'):
                await complimentCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.insult'):
                await insultCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.8ball'):
                const question = userMessage.split(' ').slice(1).join(' ');
                await eightBallCommand(sock, chatId, question);
                break;
            case userMessage.startsWith('.lyrics'):
                const songTitle = userMessage.split(' ').slice(1).join(' ');
                await lyricsCommand(sock, chatId, songTitle);
                break;
            case userMessage.startsWith('.simp'):
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                break;
            case userMessage.startsWith('.stupid') || userMessage.startsWith('.itssostupid') || userMessage.startsWith('.iss'):
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const stupidArgs = userMessage.split(' ').slice(1);
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, stupidArgs);
                break;
            case userMessage === '.dare':
                await dareCommand(sock, chatId, message);
                break;
            case userMessage === '.truth':
                await truthCommand(sock, chatId, message);
                break;
            case userMessage === '.clear':
                if (isGroup) await clearCommand(sock, chatId);
                break;
            case userMessage.startsWith('.promote'):
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                break;
            case userMessage.startsWith('.demote'):
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                break;
            case userMessage === '.ping':
                await pingCommand(sock, chatId, message);
                break;
            case userMessage === '.alive':
                await aliveCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.blur'):
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;
            case userMessage.startsWith('.welcome'):
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo });
                }
                break;
            case userMessage.startsWith('.goodbye'):
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo });
                }
                break;
            case userMessage === '.git':
            case userMessage === '.github':
            case userMessage === '.sc':
            case userMessage === '.script':
            case userMessage === '.repo':
                await githubCommand(sock, chatId);
                break;
            case userMessage.startsWith('.antibadword'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo });
                    return;
                }

                await antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;
            case userMessage.startsWith('.chatbot'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo });
                    return;
                }

                // Check if sender is admin or bot owner
                const chatbotAdminStatus = await isAdmin(sock, chatId, senderId);
                if (!chatbotAdminStatus.isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '*Only admins or bot owner can use this command*', ...channelInfo });
                    return;
                }

                const match = userMessage.slice(8).trim();
                await handleChatbotCommand(sock, chatId, message, match);
                break;
            case userMessage.startsWith('.take'):
                const takeArgs = userMessage.slice(5).trim().split(' ');
                await takeCommand(sock, chatId, message, takeArgs);
                break;
            case userMessage === '.flirt':
                await flirtCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.character'):
                await characterCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.waste'):
                await wastedCommand(sock, chatId, message);
                break;
            case userMessage === '.ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;
            case userMessage === '.groupinfo' || userMessage === '.infogp' || userMessage === '.infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;
            case userMessage === '.resetlink' || userMessage === '.revoke' || userMessage === '.anularlink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                break;
            case userMessage === '.staff' || userMessage === '.admins' || userMessage === '.listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.emojimix') || userMessage.startsWith('.emix'):
                await emojimixCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tg') || userMessage.startsWith('.stickertelegram') || userMessage.startsWith('.tgsticker') || userMessage.startsWith('.telesticker'):
                await stickerTelegramCommand(sock, chatId, message);
                break;

            case userMessage === '.vv':
                await viewOnceCommand(sock, chatId, message);
                break;
            case userMessage === '.clearsession' || userMessage === '.clearsesi':
                await clearSessionCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.autostatus'):
                const autoStatusArgs = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, autoStatusArgs);
                break;
            case userMessage.startsWith('.simp'):
                await simpCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.metallic'):
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                break;
            case userMessage.startsWith('.ice'):
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                break;
            case userMessage.startsWith('.snow'):
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                break;
            case userMessage.startsWith('.impressive'):
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                break;
            case userMessage.startsWith('.matrix'):
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                break;
            case userMessage.startsWith('.light'):
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                break;
            case userMessage.startsWith('.neon'):
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                break;
            case userMessage.startsWith('.devil'):
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                break;
            case userMessage.startsWith('.purple'):
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                break;
            case userMessage.startsWith('.thunder'):
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                break;
            case userMessage.startsWith('.leaves'):
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                break;
            case userMessage.startsWith('.1917'):
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                break;
            case userMessage.startsWith('.arena'):
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                break;
            case userMessage.startsWith('.hacker'):
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                break;
            case userMessage.startsWith('.sand'):
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                break;
            case userMessage.startsWith('.blackpink'):
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                break;
            case userMessage.startsWith('.glitch'):
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                break;
            case userMessage.startsWith('.fire'):
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                break;
            case userMessage.startsWith('.antidelete'):
                const antideleteMatch = userMessage.slice(11).trim();
                await handleAntideleteCommand(sock, chatId, message, antideleteMatch);
                break;
            case userMessage === '.surrender':
                // Handle surrender command for tictactoe game
                await handleTicTacToeMove(sock, chatId, senderId, 'surrender');
                break;
            case userMessage === '.cleartmp':
                await clearTmpCommand(sock, chatId, message);
                break;
            case userMessage === '.setpp':
                await setProfilePicture(sock, chatId, message);
                break;
            case userMessage.startsWith('.instagram') || userMessage.startsWith('.insta') || userMessage.startsWith('.ig'):
                await instagramCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.fb') || userMessage.startsWith('.facebook'):
                await facebookCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.song') || userMessage.startsWith('.music'):
                await playCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.play') || userMessage.startsWith('.mp3') || userMessage.startsWith('.ytmp3') || userMessage.startsWith('.yts'):
                await songCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.video') || userMessage.startsWith('.ytmp4'):
                await videoCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tiktok') || userMessage.startsWith('.tt'):
                await tiktokCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.gpt') || userMessage.startsWith('.gemini'):
                await aiCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.translate') || userMessage.startsWith('.trt'):
                const commandLength = userMessage.startsWith('.translate') ? 10 : 4;
                await handleTranslateCommand(sock, chatId, message, userMessage.slice(commandLength));
                return;
            case userMessage.startsWith('.ss') || userMessage.startsWith('.ssweb') || userMessage.startsWith('.screenshot'):
                const ssCommandLength = userMessage.startsWith('.screenshot') ? 11 : (userMessage.startsWith('.ssweb') ? 6 : 3);
                await handleSsCommand(sock, chatId, message, userMessage.slice(ssCommandLength).trim());
                break;
            case userMessage.startsWith('.areact') || userMessage.startsWith('.autoreact') || userMessage.startsWith('.autoreaction'):
                const isOwner = message.key.fromMe;
                await handleAreactCommand(sock, chatId, message, isOwner);
                break;
            case userMessage === '.goodnight' || userMessage === '.lovenight' || userMessage === '.gn':
                await goodnightCommand(sock, chatId, message);
                break;
            case userMessage === '.shayari' || userMessage === '.shayri':
                await shayariCommand(sock, chatId, message);
                break;
            case userMessage === '.roseday':
                await rosedayCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.imagine') || userMessage.startsWith('.flux') || userMessage.startsWith('.dalle'):
                await imagineCommand(sock, chatId, message);
                break;
            case userMessage === '.jid':
                await groupJidCommand(sock, chatId, message);
                break;

                // Function to handle .groupjid command
                async function groupJidCommand(sock, chatId, message) {
                    const groupJid = message.key.remoteJid;

                    if (!groupJid.endsWith('@g.us')) {
                        return await sock.sendMessage(chatId, {
                            text: "❌ This command can only be used in a group."
                        });
                    }

                    await sock.sendMessage(chatId, {
                        text: `✅ Group JID: ${groupJid}`
                    }, {
                        quoted: message
                    });
                }

            default:
                if (isGroup) {
                    // Handle non-command group messages
                    if (userMessage) {  // Make sure there's a message
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    }
                    await Antilink(message, sock);
                    await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
                }
                break;
        }

        if (userMessage.startsWith('.')) {
            // After command is processed successfully
            await addCommandReaction(sock, message);
        }
    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        // Only try to send error message if we have a valid chatId
        if (chatId) {
            await sock.sendMessage(chatId, {
                text: '❌ Failed to process command!',
                ...channelInfo
            });
        }
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Check if it's a group
        if (!id.endsWith('@g.us')) return;

        // Handle promotion events
        if (action === 'promote') {
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }

        // Handle demotion events
        if (action === 'demote') {
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }

        // Handle join events
        if (action === 'add') {
            // Check if welcome is enabled for this group
            const isWelcomeEnabled = await isWelcomeOn(id);
            if (!isWelcomeEnabled) return;

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(id);
            const groupName = groupMetadata.subject;
            const groupDesc = groupMetadata.desc || 'No description available';

            // Get welcome message from data
            const data = JSON.parse(fs.readFileSync('./data/userGroupData.json'));
            const welcomeData = data.welcome[id];
            const welcomeMessage = welcomeData?.message || 'Welcome {user} to the group! 🎉';
            const channelId = welcomeData?.channelId || '120363161513685998@newsletter';

            // Send welcome message for each new participant
            for (const participant of participants) {
                const user = participant.split('@')[0];
                const formattedMessage = welcomeMessage
                    .replace('{user}', `@${user}`)
                    .replace('{group}', groupName)
                    .replace('{description}', groupDesc);

                await sock.sendMessage(id, {
                    text: formattedMessage,
                    mentions: [participant],
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: channelId,
                            newsletterName: 'KnightBot MD',
                            serverMessageId: -1
                        }
                    }
                });
            }
        }

        // Handle leave events
        if (action === 'remove') {
            // Check if goodbye is enabled for this group
            const isGoodbyeEnabled = await isGoodByeOn(id);
            if (!isGoodbyeEnabled) return;

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(id);
            const groupName = groupMetadata.subject;

            // Get goodbye message from data
            const data = JSON.parse(fs.readFileSync('./data/userGroupData.json'));
            const goodbyeData = data.goodbye[id];
            const goodbyeMessage = goodbyeData?.message || 'Goodbye {user} 👋';
            const channelId = goodbyeData?.channelId || '120363161513685998@newsletter';

            // Send goodbye message for each leaving participant
            for (const participant of participants) {
                const user = participant.split('@')[0];
                const formattedMessage = goodbyeMessage
                    .replace('{user}', `@${user}`)
                    .replace('{group}', groupName);

                await sock.sendMessage(id, {
                    text: formattedMessage,
                    mentions: [participant],
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: channelId,
                            newsletterName: 'KnightBot MD',
                            serverMessageId: -1
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

// Instead, export the handlers along with handleMessages
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
    }
};