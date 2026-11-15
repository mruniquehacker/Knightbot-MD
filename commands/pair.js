const axios = require('axconst axios = require('axios');
const { sleep } = require('../lib/myfunc');
const settings = require('../settings');

async function pairCommand(sock, chatId, message, q, sender) {
    try {
        // Sigma Ego Check: Sirf aur sirf Developer (Kartik Editz) hi use kar payega
        const senderNumber = sender.replace(/[^0-9]/g, '');
        if (senderNumber !== settings.ownerNumber) {
            return await sock.sendMessage(chatId, { 
                text: "⚠️ *Aukat mein reh bhai!* 🗿\nYeh command sirf mere Creator & Developer **Kartik Editz** ke liye locked hai. Tu ise touch bhi nahi kar sakta! 😎\n\n🙏 *Radhe Radhe 🦚*" 
            }, { quoted: message });
        }

        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "🗿 *System Command Format Error!*\nSahi tarika use kar:\nExample: `.pair 917602230748`\n\n🔥 *KA-BOT-MD | Developer: Kartik Editz*\n🙏 *Radhe Radhe 🦚*",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KA-BOT-MD - Sigma Edition',
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        }

        const numbers = q.split(',')
            .map(v => v.replace(/[^0-9]/g, ''))
            .filter(v => v.length > 5 && v.length < 20);

        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ *Invalid Number Format!* Sahi number daal.\n\n🙏 *Radhe Radhe 🦚*",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KA-BOT-MD - Sigma Edition',
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        }

        for (const number of numbers) {
            const whatsappID = number + '@s.whatsapp.net';
            const result = await sock.onWhatsApp(whatsappID);

            if (!result[0]?.exists) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *Number WhatsApp par exist nahi karta!*\n\n🙏 *Radhe Radhe 🦚*`,
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363161513685998@newsletter',
                            newsletterName: 'KA-BOT-MD - Sigma Edition',
                            serverMessageId: -1
                        }
                    }
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, {
                text: "⚡ *Generating pairing code, hold your attitude...*",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KA-BOT-MD - Sigma Edition',
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });

            const response = await axios.get(`https://knight-bot-paircode.onrender.com/code?number=${number}`);

            if (response.data && response.data.code) {
                const code = response.data.code;
                if (code === "Service Unavailable") {
                    throw new Error('Service Unavailable');
                }

                await sleep(5000);
                await sock.sendMessage(chatId, {
                    text: `╔══════════════════════╗\n     🔥 *KA-BOT-MD* 🔥     \n╚══════════════════════╝\n🔑 *Your Pairing Code:* \`${code}\`\n\n👑 *Owner & Creator:* Kartik Editz\n🔥 *Powered by Ego & Code*\n🙏 *Radhe Radhe 🦚*`,
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363161513685998@newsletter',
                            newsletterName: 'KA-BOT-MD - Sigma Edition',
                            serverMessageId: -1
                        }
                    }
                }, { quoted: message });

            } else {
                throw new Error('Invalid response from server');
            }
        }
    } catch (apiError) {
        console.error('API Error:', apiError);
        const errorMessage = apiError.message === 'Service Unavailable' 
            ? "⚠️ *Server busy hai, thoda sabr kar bhai!*\n\n🙏 *Radhe Radhe 🦚*" 
            : "❌ *Code generation failed!* Dobara try kar.\n\n🙏 *Radhe Radhe 🦚*";

        await sock.sendMessage(chatId, {
            text: errorMessage,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363161513685998@newsletter',
                    newsletterName: 'KA-BOT-MD - Sigma Edition',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, {
            text: "❌ *Critical Error Occurred!* System temporarily locked.\n\n🙏 *Radhe Radhe 🦚*",
            contextInfo: {
                forwardingScore: 1,
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

module.exports = pairCommand;
