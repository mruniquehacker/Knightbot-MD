const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const webp = require('node-webpmuxt');
const crypto = require('crypto');

async function stickerCommand(sock, chatId, message) {
    try {
        let messageToQuote = message;
        let targetMessage = message;

        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedInfo = message.message.extendedTextMessage.contextInfo;
            targetMessage = {
                key: {
                    remoteJid: chatId,
                    id: quotedInfo.stanzaId,
                    participant: quotedInfo.participant
                },
                message: quotedInfo.quotedMessage
            };
        }

        const mediaMessage = targetMessage.message?.imageMessage || 
                             targetMessage.message?.videoMessage || 
                             targetMessage.message?.documentMessage;

        if (!mediaMessage) {
            return await sock.sendMessage(chatId, {
                text: "🗿 *Aukat mein reh bhai!* Kisi image ya video par reply karke `.s` ya `.sticker` likh, tabhi sticker banega!\n\n🔥 *KA-BOT-MD | Developer: Kartik Editz*\n🙏 *Radhe Radhe 🦚*",
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KA-BOT-MD - Sigma Edition',
                        serverMessageId: -1
                    }
                }
            }, { quoted: messageToQuote });
        }

        const mediaBuffer = await downloadMediaMessage(
            targetMessage,
            'buffer',
            {},
            {
                logger: undefined,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!mediaBuffer) {
            return await sock.sendMessage(chatId, {
                text: "❌ *Media download fail ho gaya!* Dobara try kar.\n\n🙏 *Radhe Radhe 🦚*",
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KA-BOT-MD - Sigma Edition',
                        serverMessageId: -1
                    }
                }
            }, { quoted: messageToQuote });
        }

        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const tempInput = path.join(tmpDir, `temp_${Date.now()}`);
        const tempOutput = path.join(tmpDir, `sticker_${Date.now()}.webp`);

        fs.writeFileSync(tempInput, mediaBuffer);

        const isAnimated = mediaMessage.mimetype?.includes('gif') || 
                           mediaMessage.mimetype?.includes('video') || 
                           mediaMessage.seconds > 0;

        const ffmpegCommand = isAnimated
            ? `ffmpeg -y -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=transparent" -loop 0 -an -vsync 0 -vcodec libwebp -lossless 1 -qscale:v 73 -preset default "${tempOutput}"`
            : `ffmpeg -y -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=transparent" -vcodec libwebp -lossless 1 -qscale:v 73 -preset default "${tempOutput}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error) => {
                if (error) {
                    console.error('FFmpeg error:', error);
                    reject(error);
                } else resolve();
            });
        });

        let webpBuffer = fs.readFileSync(tempOutput);

        if (isAnimated && webpBuffer.length > 1000 * 1024) {
            try {
                const tempOutput2 = path.join(tmpDir, `sticker_fall_${Date.now()}.webp`);
                const fileSizeKB = mediaBuffer.length / 1024;
                const isLargeFile = fileSizeKB > 5000;
                const fallbackCmd = isLargeFile
                    ? `ffmpeg -y -i "${tempInput}" -t 2 -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=12,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=transparent" -loop 0 -an -vsync 0 -vcodec libwebp -qscale:v 40 "${tempOutput2}"`
                    : `ffmpeg -y -i "${tempInput}" -t 3 -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=transparent" -loop 0 -an -vsync 0 -vcodec libwebp -qscale:v 50 "${tempOutput2}"`;
                
                await new Promise((resolve, reject) => {
                    exec(fallbackCmd, (error) => error ? reject(error) : resolve());
                });

                if (fs.existsSync(tempOutput2)) {
                    webpBuffer = fs.readFileSync(tempOutput2);
                    try { fs.unlinkSync(tempOutput2); } catch {}
                }
            } catch {}
        }

        let finalBuffer = webpBuffer;
        try {
            const img = new webp.Image();
            await img.load(webpBuffer);

            const json = {
                'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
                'sticker-pack-name': settings.packname || 'KA-BOT-MD',
                'emojis': ['🗿', '🔥']
            };

            const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
            const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
            const exif = Buffer.concat([exifAttr, jsonBuffer]);
            exif.writeUIntLE(jsonBuffer.length, 14, 4);
            img.exif = exif;

            finalBuffer = await img.save(null);
        } catch (e) {
            console.error(e);
        }

        await sock.sendMessage(chatId, {
            sticker: finalBuffer
        }, { quoted: messageToQuote });

        try {
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
        } catch (err) {
            console.error('Error cleaning up temp files:', err);
        }

    } catch (error) {
        console.error('Error in sticker command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Sticker creation failed!* Attitude mein thodi kami reh gayi, dobara try kar.\n\n🙏 *Radhe Radhe 🦚*',
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363161513685998@newsletter',
                    newsletterName: 'KA-BOT-MD - Sigma Edition',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });
    }
}

module.exports = stickerCommand;
