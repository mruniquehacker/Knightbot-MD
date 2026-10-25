const APIs = require('../lib/api');

async function aiCommand(sock, chatId, message) {
  try {
    const text =
      message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.replace(/^\.(?:ai|gpt|gemini)\s*/i, '').trim();

    if (!query) {
      return sock.sendMessage(
        chatId,
        { text: 'Usage: `.ai <question>`\nExample: `.ai write a basic html page`' },
        { quoted: message }
      );
    }

    await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });

    let answer;
    const steps = [
      ['Knight chat', () => APIs.knightChatAI(query)],
      ['Knight gpt', () => APIs.knightGptAI(query)],
      ['fallback', () => APIs.fallbackChatAI(query)],
    ];

    for (const [name, run] of steps) {
      try {
        answer = await run();
        if (answer) {
          console.log(`[ai] OK via ${name}`);
          break;
        }
      } catch (err) {
        console.log(`[ai] ${name} failed:`, err?.message || err);
      }
    }

    if (!answer) {
      return sock.sendMessage(
        chatId,
        { text: '❌ Failed to get AI response. Try again later.' },
        { quoted: message }
      );
    }

    await sock.sendMessage(chatId, { text: answer }, { quoted: message });
  } catch (err) {
    console.error('[ai]', err?.message || err);
    await sock.sendMessage(
      chatId,
      { text: '❌ An error occurred. Please try again later.' },
      { quoted: message }
    );
  }
}

module.exports = aiCommand;
