const settings = require('../settings');
const fs = require('fs');
const path = require('path');

async function helpCommand(sock, chatId, message) {
    const helpMessage = `
╔═══════════════════╗
   * ${settings.botName || 'KnightBot-MD'}*  
   The Crib Bot
   by ${settings.botOwner || 'Mr Unique Hacker'}
   
╚═══════════════════╝

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
║ ➤ .help
║ ➤ .ping
║ ➤ .alive
║ ➤ .tts 
║ ➤ .owner
║ ➤ .joke
║ ➤ .quote
║ ➤ .fact
║ ➤ .weather 
║ ➤ .news
║ ➤ .attp
║ ➤ .lyrics 
║ ➤ .8ball 
║ ➤ .groupinfo
║ ➤ .admins
║ ➤ .vv
║ ➤ .trt 
║ ➤ .ss 
║ ➤ .jid
╚═══════════════════╝ 

╔═══════════════════╗
 *Admin Commands*:
║ ➤ .ban 
║ ➤ .promote 
║ ➤ .demote 
║ ➤ .mute 
║ ➤ .unmute
║ ➤ .delete 
║ ➤ .kick 
║ ➤ .warnings
║ ➤ .warn 
║ ➤ .antilink
║ ➤ .antibadword
║ ➤ .clear
║ ➤ .tag 
║ ➤ .tagall
║ ➤ .chatbot
║ ➤ .resetlink
║ ➤ .welcome 
║ ➤ .goodbye 
╚═══════════════════

╔═══════════════════
 *Owner Commands*:
║ ➤ .mode
║ ➤ .autostatus
║ ➤ .clearsession
║ ➤ .antidelete
║ ➤ .cleartmp
║ ➤ .setpp 
║ ➤ .autoreact
╚═══════════════════╝

╔═══════════════════╗
 *Sticker Commands*:
║ ➤ .blur 
║ ➤ .simage 
║ ➤ .sticker 
║ ➤ .tgsticker 
║ ➤ .meme
║ ➤ .take 
║ ➤ .emojimix 
╚═══════════════════╝  

╔═══════════════════╗
 *Game Commands*:
║ ➤ .tictactoe 
║ ➤ .hangman
║ ➤ .guess 
║ ➤ .trivia
║ ➤ .answer 
║ ➤ .truth
║ ➤ .dare
╚═══════════════════

╔═══════════════════
 *AI Commands*:
║ ➤ .gpt 
║ ➤ .gemini 
║ ➤ .imagine 
║ ➤ .flux 
╚═══════════════════

╔═══════════════════
 *Fun*
║ ➤ .compliment 
║ ➤ .insult 
║ ➤ .flirt 
║ ➤ .shayari
║ ➤ .goodnight
║ ➤ .roseday
║ ➤ .character
║ ➤ .wasted
║ ➤ .ship 
║ ➤ .simp 
║ ➤ .stupid 
╚═══════════════════

╔═══════════════════╗
 *Textmaker*:
║ ➤ .metallic 
║ ➤ .ice 
║ ➤ .snow 
║ ➤ .impressive 
║ ➤ .matrix 
║ ➤ .light 
║ ➤ .neon 
║ ➤ .devil 
║ ➤ .purple 
║ ➤ .thunder 
║ ➤ .leaves 
║ ➤ .1917 
║ ➤ .arena 
║ ➤ .hacker 
║ ➤ .sand 
║ ➤ .blackpink 
║ ➤ .glitch 
║ ➤ .fire 
╚═══════════════════╝

╔═══════════════════╗
 *Dl*:
║ ➤ .play 
║ ➤ .song
║ ➤ .instagram 
║ ➤ .facebook 
║ ➤ .tiktok 
║ ➤ .video 
║ ➤ .ytmp4 
╚═══════════════════╝

╔═══════════════════╗
*Github*
║ ➤ .git
║ ➤ .github
║ ➤ .sc
║ ➤ .script
║ ➤ .repo
╚═══════════════════╝

Join our channel for updates:`;

    try {
        const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
        
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KELIN MD',
                        serverMessageId: -1
                    }
                }
            },{ quoted: message });
        } else {
            console.error('Bot image not found at:', imagePath);
            await sock.sendMessage(chatId, { 
                text: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'KELIN MD',
                        serverMessageId: -1
                    } 
                }
            });
        }
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage });
    }
}

module.exports = helpCommand;
