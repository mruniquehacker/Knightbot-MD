const { setChatbot, getChatbot, removeChatbot } = require('../sql');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Load chatbot config
function loadChatbotConfig(groupId) {
    try {
        const configPath = path.join(__dirname, '../data/chatbot.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const data = JSON.parse(fs.readFileSync(configPath));
        return data[groupId];
    } catch (error) {
        console.error('❌ Error loading chatbot config:', error.message);
        return null;
    }
}

async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*CHATBOT SETUP*\n\n*.chatbot on*\nEnable chatbot\n\n*.chatbot off*\nDisable chatbot in this group`
        });
    }

    if (match === 'on') {
        const existingConfig = await getChatbot(chatId);
        if (existingConfig?.enabled) {
            return sock.sendMessage(chatId, { text: '*Chatbot is already enabled for this group*' });
        }
        await setChatbot(chatId, true);
        console.log(`✅ Chatbot settings updated for group ${chatId}`);
        return sock.sendMessage(chatId, { text: '*Chatbot has been enabled for this group*' });
    }

    if (match === 'off') {
        const config = await getChatbot(chatId);
        if (!config?.enabled) {
            return sock.sendMessage(chatId, { text: '*Chatbot is already disabled for this group*' });
        }
        await removeChatbot(chatId);
        console.log(`✅ Chatbot settings updated for group ${chatId}`);
        return sock.sendMessage(chatId, { text: '*Chatbot has been disabled for this group*' });
    }

    return sock.sendMessage(chatId, { text: '*Invalid command. Use .chatbot to see usage*' });
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const config = loadChatbotConfig(chatId);
    if (!config?.enabled) return;

    try {
        // Debug logs
        console.log('Starting chatbot response handler');
        console.log('Chat ID:', chatId);
        console.log('User Message:', userMessage);

        // Get bot's ID
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        console.log('Bot Number:', botNumber);

        // Check for mentions and replies
        let isBotMentioned = false;
        let isReplyToBot = false;

        // Check if message is a reply and contains bot mention
        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;
            
            // Check if bot is mentioned in the reply
            isBotMentioned = mentionedJid.some(jid => jid === botNumber);
            
            // Check if replying to bot's message
            isReplyToBot = quotedParticipant === botNumber;
            
            console.log('Message is a reply with mention:', {
                mentionedJid,
                quotedParticipant,
                isBotMentioned,
                isReplyToBot
            });
        }
        // Also check regular mentions in conversation
        else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber.split('@')[0]}`);
        }

        if (!isBotMentioned && !isReplyToBot) {
            console.log('Bot not mentioned or replied to');
            return;
        }

        // Clean the message
        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber.split('@')[0]}`, 'g'), '').trim();
        }

        // Get GPT-3 response
        const response = await getGPT3Response(cleanedMessage || "hi");
        console.log('GPT-3 Response:', response);

        if (!response) {
            await sock.sendMessage(chatId, { 
                text: "I couldn't process your request at the moment.",
                quoted: message
            });
            return;
        }

        // Send response as a reply with mention
        await sock.sendMessage(chatId, {
            text: `@${senderId.split('@')[0]} ${response}`,
            quoted: message,
            mentions: [senderId]
        });

        // Only log successful responses
        console.log(`✅ Chatbot responded in group ${chatId}`);
    } catch (error) {
        console.error('❌ Error in chatbot response:', error.message);
        await sock.sendMessage(chatId, { 
            text: "Sorry, I encountered an error while processing your message.",
            quoted: message,
            mentions: [senderId]
        });
    }
}

async function getGPT3Response(userMessage) {
    try {
        console.log('Getting GPT-3 response for:', userMessage);
        
        const systemPrompt = {
            role: "system",
            content: "You are KnightBot CHATBOT, an intelligent and feature-rich assistant. Behave like human and talk like human. Understand how sender responds, behaves accordingly. Enhance your responses with relevant emojis when appropriate while maintaining clarity and professionalism."
        };

        const userPrompt = {
            role: "user",
            content: userMessage
        };

        const response = await fetch("https://api.yanzbotz.live/api/ai/gpt3", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                messages: [systemPrompt, userPrompt] 
            })
        });

        if (!response.ok) {
            console.error('GPT-3 API response not ok:', response.status);
            throw new Error("API call failed");
        }

        const data = await response.json();
        console.log('GPT-3 API response:', data);
        return data.result;

    } catch (error) {
        console.error("GPT-3 API error:", error);
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
}; 