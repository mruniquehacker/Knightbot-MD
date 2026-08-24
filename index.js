/**
 * Knight Bot - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const { createConfig, validateConfig } = require('./core/config');
const { createStore } = require('./core/store');
const { createAiProvider } = require('./core/ai');
const { createAssistant } = require('./core/assistant');
const { createRateLimiter } = require('./core/rate-limit');
const { createLogger } = require('./core/logger');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const { 
    default: makeWASocket,
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    makeInMemoryStore,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

const store = makeInMemoryStore({
    logger: pino().child({
        level: 'silent',
        stream: 'store'
    })
})

const assistantConfig = createConfig();
const configValidation = validateConfig(assistantConfig);
if (!configValidation.valid) {
    for (const error of configValidation.errors) console.error(`[config] ${error}`);
    throw new Error('Invalid configuration');
}
for (const warning of configValidation.warnings) console.warn(`[config] ${warning}`);
const assistantStore = createStore(assistantConfig.dataPath);
const assistantLogger = createLogger(assistantConfig);
const assistantRateLimiter = createRateLimiter({ windowMs: assistantConfig.rateLimitWindowMs, max: assistantConfig.rateLimitMax });
const assistant = createAssistant({
    config: assistantConfig,
    store: assistantStore,
    aiProvider: createAiProvider(assistantConfig),
    logger: assistantLogger,
    rateLimiter: assistantRateLimiter,
});
const owner = assistantConfig.ownerNumber;

global.botname = assistantConfig.botName
global.themeemoji = "•"

const pairingCode = process.argv.includes("--pairing-code") || process.env.PAIRING_CODE === 'true'
const useMobile = process.argv.includes("--mobile")
let reconnectAttempts = 0
let reconnectTimer = null

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))
         
async function startXeonBotInc() {
    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(`./session`)
    const msgRetryCounterCache = new NodeCache()

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    })

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek?.message) return

            const assistantHandled = await assistant.handleMessage(XeonBotInc, chatUpdate)
            if (assistantHandled) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
            if (mek.key?.id?.startsWith('BAE5') && mek.key.id.length === 16) return
            
            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, { 
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363161513685998@newsletter',
                                newsletterName: 'KnightBot MD',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact 
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Handle pairing code
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let phoneNumber = process.env.PAIRING_PHONE_NUMBER || ''
        if (!phoneNumber) {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number in international format: `)))
        }

        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
        if (!phoneNumber) throw new Error('A valid pairing phone number is required')

        // Request pairing code
        setTimeout(async () => {
            let code = await XeonBotInc.requestPairingCode(phoneNumber)
            code = code?.match(/.{1,4}/g)?.join("-") || code
            console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
        }, 3000)
    }

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s
        if (connection == "open") {
            reconnectAttempts = 0
            const connectedJid = XeonBotInc.user?.id || '';
            assistantLogger.info('whatsapp_connected', { hasIdentity: Boolean(connectedJid), mode: assistantStore.getMode() });
            if (assistantConfig.sendConnectMessage && connectedJid) {
                const botNumber = connectedJid.split(':')[0] + '@s.whatsapp.net';
                await XeonBotInc.sendMessage(botNumber, { text: `${assistantConfig.botName} is connected and ready.` });
            }
            console.log(chalk.green(`${assistantConfig.botName} connected successfully.`))
        }
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                assistantLogger.error('whatsapp_logged_out', { statusCode })
                return
            }
            if (reconnectTimer) return
            const delayMs = Math.min(60_000, 1_000 * (2 ** Math.min(reconnectAttempts, 6)))
            reconnectAttempts += 1
            assistantLogger.warn('whatsapp_reconnect_scheduled', { delayMs, statusCode })
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null
                startXeonBotInc().catch((error) => assistantLogger.error('whatsapp_reconnect_failed', { error: error.message }))
            }, delayMs)
        }
    })

    XeonBotInc.ev.on('creds.update', saveCreds)
    
    // Modify the event listener to log the update object
    XeonBotInc.ev.on('group-participants.update', async (update) => {
        console.log('Group Update Event:', JSON.stringify(update, null, 2));  // Add this line to debug
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    // Handle status updates
    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    // Handle message reactions (some status updates come through here)
    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
}


// Start the bot with error handling
startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})

// Better error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    // Don't exit immediately to allow reconnection
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
    // Don't exit immediately to allow reconnection
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})